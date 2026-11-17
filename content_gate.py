"""Mandatory CONTENT_STANDARD gate. No approval or baseline is inferred by this tool."""
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys
import tempfile

FILES = ('1-long-form-agent.mp4','2-long-form-no-agent.mp4','3-short-agent.mp4',
         '4-short-no-agent.mp4','5-blog-agent.html','6-blog-no-agent.html',
         '7-email-agent.html','8-email-no-agent.html','9-blog-embed.html',
         '10-subdomain.html','11-youtube-metadata.txt')
REPOS = ('aa-video-pipeline','customer_housing_analysis','re-data','aa-blog')


def fail(rule, detail):
    raise ValueError(rule+': '+detail)


def validate_contract(contract):
    """Validate measured render/browser evidence; missing checks fail closed."""
    if set(contract.get('files',{})) != set(FILES):fail('CS14','exact eleven assets required')
    reports=contract.get('reports',{})
    if set(reports) != {'90004','93536'}:fail('CS13','both review ZIPs required')
    for z,r in reports.items():
        if bool(r.get('agent')) != (z=='93536'):fail('CS02','wrong territory identity '+z)
        if r.get('composition') != 'ZipMarketReportShorts' or r.get('deckImagesInShort') is not False:fail('CS05','Short must use native scenes without deck images '+z)
        if not 0<float(r.get('encodedShortSeconds',0))<=30:fail('CS05','Short exceeds 30 seconds '+z)
        if r.get('shortDimensions') != [1080,1920]:fail('CS05','native dimensions changed '+z)
        if r.get('voice') not in ('Alex','Ashley') or r.get('ttsModel')!='inworld-tts-2-flash' or r.get('playbackRates')!=[1]:fail('CS03','voice/model/pace changed '+z)
        if r.get('forbiddenNarration') or r.get('readsAllSlideNumbers') or r.get('factualAudit')!='PASS':fail('CS01/CS07','narration violates the factual/natural contract '+z)
        if not 0<int(r.get('headlineCharacters',0))<=60 or not 0<int(r.get('subjectCharacters',0))<=60:fail('CS08','headline/subject limit '+z)
        if not 0<int(r.get('openingWords',0))<=25 or r.get('openingSentences')!=1:fail('CS08','opening length/shape '+z)
        titles=r.get('youtubeTitleCharacters',[])
        if len(titles)!=2 or any(not 0<n<=100 for n in titles):fail('CS11','YouTube title limit '+z)
        if r.get('duplicateDescriptionLines') or r.get('youtubeAudit')!='PASS':fail('CS11','duplicate or invalid descriptions '+z)
        texts=r.get('narration',[])
        if not texts:fail('CS13','literal rendered narration required '+z)
        bad=re.compile(r'\b(?:minus|plus|ZIP code)\b|(?<!\w)[+\-\u2212]\s*\$?\d',re.I)
        if any(bad.search(t) for t in texts):fail('CS07','prohibited narration '+z)
        audits=r.get('slideAudit',[])
        if len(audits)<5 or any(a.get('readsAllNumbers') is not False or a.get('validNumbers') is not True for a in audits):fail('CS07','slide recitation or factual validation failed '+z)
        if len(r.get('subject',''))>60 or len(r.get('headline',''))>60:fail('CS08','literal headline/subject limit '+z)
        if len(r.get('youtubeTitles',[]))!=2 or any(len(t)>100 for t in r['youtubeTitles']):fail('CS11','literal YouTube title limit '+z)
        if len(r.get('youtubeDescriptions',[]))!=2:fail('CS11','both descriptions required '+z)
        for description in r['youtubeDescriptions']:
            lines=[' '.join(line.lower().split()) for line in description.splitlines() if line.strip()]
            if len(lines)!=len(set(lines)):fail('CS11','duplicate description lines '+z)
        if r.get('decode')!='PASS':fail('CS13','full media decode required '+z)
    layouts=contract.get('browser',[])
    if len(layouts)<12:fail('CS13','six HTML assets at desktop and mobile widths required')
    for result in layouts:
        if result.get('whiteCards')!=1 or result.get('boxedSections')!=0 or not result.get('grayBackground'):fail('CS10','one white card on gray required: '+result.get('file','unknown'))
        if result.get('fixedSignup') or result.get('stickySignup') or result.get('signupScrollsAway') is False:fail('CS10','signup must scroll normally: '+result.get('file','unknown'))
        if result.get('overflow') or result.get('brokenImages'):fail('CS10','broken/overflowing layout: '+result.get('file','unknown'))
    if contract.get('actualAgentEmbed') is not True:fail('CS10','actual drop-in agent embed required')
    return contract


def compare_baseline(approved, current):
    validate_contract(current)
    # Exact approved semantic/render evidence is deliberately stricter than a
    # tolerance that could hide an unrequested layout, voice or wording change.
    for facet in ('contentFingerprints','renderInputs','frames','copy','layout','charts','voices','metadata'):
        if facet not in approved or current.get(facet)!=approved[facet]:fail('CS14','unapproved change in '+facet+'; review and explicit approval required')


def predeploy(repo=None):
    repo=Path(repo or __file__).resolve()
    if repo.is_file():repo=repo.parent
    baseline=repo/'approved-content-baseline'
    manifest=baseline/'manifest.json'
    if not manifest.is_file():fail('CS14','Part H awaits explicit approval of FINAL-redfin; deployment blocked')
    approved=json.loads(manifest.read_text())
    if approved.get('approvalStatus')!='user-approved':fail('CS14','baseline is not explicitly user-approved')
    for filename in FILES:
        target=baseline/filename
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest()!=approved.get('files',{}).get(filename):fail('CS14','approved file missing or changed: '+filename)
    for args in (['diff','--name-only'],['diff','--cached','--name-only']):
        if subprocess.check_output(['git',*args],cwd=repo,text=True).strip():fail('CS13','commit and push before deploying')
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    branch=subprocess.check_output(['git','branch','--show-current'],cwd=repo,text=True).strip()
    remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/'+branch],cwd=repo,text=True).split()
    if not remote or remote[0]!=head:fail('CS13','commit is not pushed')
    parent=repo.parent
    video=parent/'aa-video-pipeline'
    runner=video/'scripts/render_content_review.py'
    if not runner.is_file():fail('CS13','the committed review renderer is required in the sibling video checkout')
    if not (baseline/'render-inputs').is_dir():fail('CS14','approved real render inputs are missing; do not fabricate them')
    with tempfile.TemporaryDirectory(prefix='aa-content-predeploy-') as directory:
        output=Path(directory)
        subprocess.run([sys.executable,str(runner),'--inputs',str(baseline/'render-inputs'),'--output',str(output)],check=True)
        current=json.loads((output/'content-contract.json').read_text())
        compare_baseline(approved,current)
    print('PASS CONTENT_STANDARD: both ZIPs re-rendered; approved baseline unchanged')


if __name__=='__main__':
    try:predeploy()
    except (ValueError,KeyError,FileNotFoundError,subprocess.CalledProcessError) as error:
        print('DEPLOY BLOCKED — '+str(error),file=sys.stderr)
        raise SystemExit(1) from None
