"""Mandatory CONTENT_STANDARD gate. No approval or baseline is inferred by this tool."""
import hashlib
import json
import math
import os
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


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()



# S3 object identity is stable; authorization query parameters are not content.
def s3_references(raw):
    from urllib.parse import urlsplit
    pattern=rb'https?://[^\s<>"\x27\\]+'
    def replace(match):
        value=match[0].decode('utf-8');url=urlsplit(value);host=url.hostname or ''
        virtual=re.fullmatch(r'(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com',host)
        if virtual:return ('s3://'+virtual[1]+url.path).encode('utf-8')
        if re.fullmatch(r's3(?:[.-][a-z0-9-]+)?\.amazonaws\.com',host):
            return ('s3://'+url.path.lstrip('/')).encode('utf-8')
        return match[0]
    return re.sub(pattern,replace,raw)


def comparison_sha(path):
    path=Path(path);raw=path.read_bytes()
    if path.suffix in ('.json','.html','.txt'):raw=s3_references(raw)
    return hashlib.sha256(raw).hexdigest()


def render_input_copy(source,target):
    """Adapt retained bucket/key references for existing offline HTML renderers.

    This temporary copy contains unsigned HTTPS object identifiers only. Images
    still come from retained local media; no network credentials are generated.
    """
    import shutil
    source=Path(source);target=Path(target);target.mkdir()
    for path in source.iterdir():
        dest=target/path.name
        if path.suffix=='.json' and path.is_file():
            raw=path.read_bytes()
            raw=re.sub(rb's3://([a-z0-9.-]+)/([^\s<>"\x27\\]*)',
                lambda m:b'https://'+m[1]+b'.s3.amazonaws.com/'+m[2],raw)
            dest.write_bytes(raw)
        elif path.is_dir():dest.symlink_to(path,target_is_directory=True)
        else:shutil.copy2(path,dest)
    return target


def decoded_media(path, ffmpeg=None):
    """Hash every decoded frame and every PCM sample, rather than sample frames."""
    if ffmpeg is None:
        import imageio_ffmpeg
        ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    result=subprocess.run([str(ffmpeg),'-v','error','-xerror','-i',str(path),
        '-map','0:v:0','-map','0:a:0','-c:v','rawvideo','-pix_fmt','yuv420p',
        '-c:a','pcm_s16le','-f','streamhash','-hash','sha256','-'],
        check=True,text=True,capture_output=True)
    streams={}
    for line in result.stdout.splitlines():
        match=re.fullmatch(r'\d+,([va]),SHA256=([a-f0-9]{64})',line.strip())
        if match:streams[{'v':'frames','a':'audio'}[match[1]]]=match[2]
    if set(streams)!={'frames','audio'}:fail('CS14','full decoded frame/audio hashes missing: '+Path(path).name)
    return streams


def normalized_embed(text):
    """Ignore build paths/hash and exact approved CS08/CS04 implementation deltas."""
    modules=r'(?:report-kit/(?:site-header|render|controller)|neighborhoods|money|app)\.js'
    text=re.sub(r'  // (?:[^\\\r\n]*aa-blog/)?public/embed/'+modules+r'(?=\\n|\n)',
                '  // <generated bundle path>',text)
    text=re.sub(r'(?<=data-embed-app-sha=")[a-f0-9]{64}(?=")','<derived app hash>',text)
    # The embed bundles its validator. Normalize only the explicitly approved
    # 65/75 ZIP limits and grouped-percentage grammar to the retained baseline.
    # Any other ZIP, bound, condition, text, style or script delta still fails.
    start=text.find('function assertHeadline(value, zip, names) {')
    end=text.find('CS08: exact stored name/fallback required',start) if start>=0 else -1
    if 0<=start<end<start+2000:
        body=text[start:end]
        exception_line='    const limit = ["30313", "30314", "33617", "92648", "98101"].includes(zip) ? 75 : 65;\n'
        grouped=r'(?:\d{1,3}(?:,\d{3})+|\d+)'
        for encode in (lambda value:value,lambda value:json.dumps(value)[1:-1].replace('<',r'\u003c')):
            line=encode(exception_line)
            if line in body:
                body=body.replace(line,'').replace('value.length > limit','value.length > 65')
                body=body.replace('length <= limit','length <= 65').replace(r'length \u003c= limit',r'length \u003c= 65')
            body=body.replace(encode(grouped),encode(r'\d+'))
        body=re.sub(r'(value\.length > )65(?= \|\| /YoY\|;/i\.test\(value\)\))',r'\g<1>60',body)
        body=re.sub(r'(\.length (?:\\u003c|<)= )65(?= \? full : names\.name_1;)',r'\g<1>60',body)
        text=text[:start]+body+text[end:]
    # User-approved CS04 whole-dollar PPSF correction only. Exact literals,
    # including rounding, locale and metric context; all other script deltas fail.
    approved_ppsf = [('function moneyText(value = "", pricePerSqFt = false) {', 'function moneyText(value = "") {'), ('      if (pricePerSqFt) {\n        const scale = { K: 1e3, M: 1e6, B: 1e9 }[unit] || 1;\n        const punctuation = amount.endsWith(",") ? "," : "";\n        return `${sign}$${Math.round(n * scale).toLocaleString("en-US")}${punctuation}`;\n      }\n', ''), ('moneyText(r.tldr, /per (?:square )?(?:foot|sq\\.?\\s*ft)/i.test(r.headline))', 'moneyText(r.tldr)'), ('moneyText(p, /square foot|sq\\.?\\s*ft/i.test(s.title))', 'moneyText(p)'), ('moneyText(s.title, /square foot|sq\\.?\\s*ft/i.test(s.title))', 'moneyText(s.title)'), ('moneyText(p.summary || "", /per (?:square )?(?:foot|sq\\.?\\s*ft)/i.test(p.title))', 'moneyText(p.summary || "")')]
    for after, before in approved_ppsf:
        for encode in (lambda value:value,lambda value:json.dumps(value)[1:-1].replace('<',r'\u003c')):
            text=text.replace(encode(after),encode(before))
    # Requested acquisition metadata only. Exact injected statements; all
    # markup, styles, text and other JavaScript remain byte-for-byte compared.
    attribution_only = ['    const attributionModule = "https://agentsautomated.com/visit-attribution.js";\n    const visitAttribution = !data2.mockSignup ? Promise.race([import(\n      /* @vite-ignore */\n      attributionModule\n    ).then((m) => {\n      m.captureVisit();\n      return m;\n    }).catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 2e3))]) : Promise.resolve(null);\n', '            if (!data2.mockSignup) Object.assign(payload, await (await visitAttribution)?.signupAttribution() || {});\n', "    // Forward only acquisition tags into the isolated signup frame.\n    var incomingTags = new URLSearchParams(location.search);\n    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (field) {\n      var value = incomingTags.get(field) || '';\n      if (value.trim() && value.trim().length <= 200 && !/[\\u0000-\\u001f\\u007f]/.test(value)) url.searchParams.set(field, value.trim());\n    });\n"]
    def encoded(value):return json.dumps(value)[1:-1].replace('<',r'\u003c')
    for statement in attribution_only:
        # The actual iframe srcdoc serializes its bundle twice; the standalone
        # fixture uses a different collision-free local name. Match only these
        # exact two injected statements in either representation.
        for literal in (statement,statement.replace('data2.mockSignup','data.mockSignup'),statement.replace('location.search','globalThis.__AA_REVIEW_QUERY')):
            for encode in (lambda value:value,encoded,lambda value:encoded(encoded(value))):
                text=text.replace(encode(literal),'')
    return s3_references(text.encode('utf-8')).decode('utf-8')


def video_exact(inputs,evidence,decoded):
    """Exact audio, scene PNGs, spoken/caption text, and canonical Remotion props."""
    inputs=Path(inputs);evidence=Path(evidence);result={}
    for z,kind,filename in [('93536','long',FILES[0]),('90004','long',FILES[1]),
                             ('93536','short',FILES[2]),('90004','short',FILES[3])]:
        p=inputs/(z+'-'+kind+'-props.json');props=json.loads(p.read_text())
        receipt=json.loads((evidence/(filename+'.render.json')).read_text())
        scenes={}
        def images(value):
            if isinstance(value,str) and value.startswith('media://') and value.lower().endswith('.png'):
                name=Path(value[8:]).name;scenes['source/'+name]=sha(inputs/'media'/name)
            elif isinstance(value,list):
                for item in value:images(item)
            elif isinstance(value,dict):
                for item in value.values():images(item)
        images(props)
        segments=props['shortsSegments' if kind=='short' else 'pageNarrationSegments']
        if kind=='short':
            for segment in segments:
                name=filename+'.'+segment['id']+'.png'
                scenes['native/'+name]=sha(evidence/name)
        result[filename]={'audio':decoded[filename]['audio'],'scenePNGs':scenes,
            'narrationCaptions':[{k:v for k,v in segment.items() if k in ('id','pageIndex','pageNumber','role','text','captions','caption')} for segment in segments],
            'nativeSceneText':receipt['nativeSceneText'],'inputPropsSha256':sha(p),
            'composition':{k:receipt[k] for k in ('composition','width','height','durationInFrames','fps')}}
    return result


def video_similarity(reference,candidate,*,fps,frames,ffmpeg=None):
    """Decode existing videos and score frames at t=0,1,2,...; never encode."""
    if ffmpeg is None:
        import imageio_ffmpeg
        ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    if not isinstance(fps,int) or not 0<fps<=120 or not isinstance(frames,int) or frames<=0:
        fail('CS14','missing approved video timing')
    with tempfile.TemporaryDirectory(prefix='aa-ssim-') as directory:
        stats=Path(directory)/'ssim.txt'
        select="select='not(mod(n,"+str(fps)+"))',setpts=N/TB"
        filters='[0:v]'+select+'[a];[1:v]'+select+'[b];[a][b]ssim=stats_file='+str(stats)+':shortest=1'
        subprocess.run([str(ffmpeg),'-v','error','-threads','1','-i',str(reference),
            '-threads','1','-i',str(candidate),'-filter_complex_threads','1','-filter_complex',filters,
            '-an','-fps_mode','passthrough','-f','null','-'],check=True,capture_output=True)
        scores=[float(value) for value in re.findall(r'\bAll:([0-9.]+)',stats.read_text())]
    if len(scores)!=math.ceil(frames/fps):fail('CS14','incomplete 1fps SSIM sample set: '+Path(candidate).name)
    return {'sampleFps':1,'threshold':0.99,'minimum':min(scores),'scores':scores}


def validate_similarity(approved,current):
    expected={name for name in FILES if name.endswith('.mp4')}
    values=current.get('videoSSIM',{})
    if set(values)!=expected:fail('CS14','1fps SSIM required for all four videos')
    for name,row in values.items():
        timing=approved['videoExact'][name]['composition'];scores=row.get('scores',[])
        if row.get('sampleFps')!=1 or row.get('threshold')!=0.99 or len(scores)!=math.ceil(timing['durationInFrames']/timing['fps']):
            fail('CS14','incomplete 1fps SSIM evidence: '+name)
        if any(not isinstance(score,(float,int)) or not math.isfinite(score) or not 0.99<=score<=1 for score in scores):
            fail('CS14','SSIM below 0.99: '+name)
        if row.get('minimum')!=min(scores):fail('CS14','incorrect minimum SSIM: '+name)


def ai_versions(repos):
    paths={p.name:Path(p) for p in repos}
    video=paths['aa-video-pipeline'];data=paths['re-data']
    prompts=video/'lambdas/shared/prompts/v1'
    required=[video/'lambdas/shared/prompt_registry.py',video/'lambdas/shared/tts_config.json',
              *sorted(prompts.glob('*.json')),
              *sorted((data/'supabase/functions/_shared/prompts').glob('*.ts'))]
    if len(list(prompts.glob('*.json')))!=4 or len(list((data/'supabase/functions/_shared/prompts').glob('*.ts')))!=2:
        fail('Part I','versioned prompt/model/example documents missing')
    sources={}
    for p in required:
        root=video if p.is_relative_to(video) else data
        sources[root.name+'/'+str(p.relative_to(root))]=sha(p)
    return {'promptVersion':'1','models':json.loads((prompts/'models.json').read_text()),'sources':sources}


def input_hashes(directory):
    directory=Path(directory)
    return {str(p.relative_to(directory)):comparison_sha(p) for p in sorted(directory.rglob('*')) if p.is_file()}


def prompt_package_files(repo):
    """The prompt loader/data must travel with every Python Lambda bundle."""
    shared=Path(repo)/'lambdas/shared'
    files={'prompt_registry.py':(shared/'prompt_registry.py').read_bytes()}
    files.update({str(p.relative_to(shared)):p.read_bytes() for p in sorted((shared/'prompts/v1').glob('*.json'))})
    return files


def add_prompt_assets(archive, repo):
    if not any(name.endswith('.py') for name in archive.namelist()):return
    for name,body in prompt_package_files(repo).items():
        if name in archive.namelist():
            if archive.read(name)!=body:fail('Part I','stale prompt asset in deployment package: '+name)
        else:archive.writestr(name,body)


def fail(rule, detail):
    raise ValueError(rule+': '+detail)


def validate_public_text(text, asset):
    if not isinstance(text,str) or not text.strip():fail('CS13','missing rendered customer text: '+asset)
    if re.search(r'Redfin|historical',text,re.I):fail('CS04/CS07','prohibited customer-facing wording: '+asset)


def validate_reader_cta(text, asset):
    if re.search(r"Own a home,\s*or thinking of buying or selling|Get this report every month|Get next month[’']s report",text,re.I):
        fail('CS09','removed bottom reader CTA or button: '+asset)


def headline_limit(zip_code):
    return 75 if zip_code in ('30313','30314','33617','92648','98101') else 65


def validate_headline(text, zip_code=None, names=None):
    if not isinstance(text,str):fail('CS08','missing headline/subject')
    value=text.removeprefix('[TEST] ')
    match=re.fullmatch(r'(.+) \((\d{5})\) (.+ (?:fell|rose|unchanged) (?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?% vs last year)',value)
    if not match or (zip_code and match[2]!=zip_code):fail('CS08','headline/subject pattern or ZIP changed')
    limit=headline_limit(match[2])
    if len(text)>limit or re.search(r'YoY|;',text,re.I):fail('CS08','headline/subject exceeds ZIP-specific limit or contains YoY or semicolon')
    if names:
        full=names['name_1']+(' & '+names['name_2'] if names.get('name_2') else '')
        full_title=full+' ('+match[2]+') '+match[3]
        expected=full if len(full_title)<=limit else names['name_1']
        if match[1]!=expected:fail('CS08','use the exact stored full name, falling back to name_1 only above this ZIP’s character limit')
    validate_public_text(value,'headline/subject')


def validate_contract(contract):
    """Validate measured render/browser evidence; missing checks fail closed."""
    if set(contract.get('files',{})) != set(FILES):fail('CS14','exact eleven assets required')
    customer=contract.get('customerFacingText',{})
    if set(customer)!=set(FILES):fail('CS13','rendered customer text required for all eleven assets')
    for asset,text in customer.items():
        validate_public_text(text,asset)
        if asset.endswith('.html'):validate_reader_cta(text,asset)
    reports=contract.get('reports',{})
    if set(reports) != {'90004','93536'}:fail('CS13','both review ZIPs required')
    for z,r in reports.items():
        if bool(r.get('agent')) != (z=='93536'):fail('CS02','wrong territory identity '+z)
        if r.get('composition') != 'ZipMarketReportShorts' or r.get('deckImagesInShort') is not False:fail('CS05','Short must use native scenes without deck images '+z)
        if not 0<float(r.get('encodedShortSeconds',0))<=30:fail('CS05','Short exceeds 30 seconds '+z)
        if r.get('shortDimensions') != [1080,1920]:fail('CS05','native dimensions changed '+z)
        if r.get('voice') not in ('Alex','Ashley') or r.get('ttsModel')!='inworld-tts-2-flash' or r.get('playbackRates')!=[1]:fail('CS03','voice/model/pace changed '+z)
        if r.get('forbiddenNarration') or r.get('readsAllSlideNumbers') or r.get('factualAudit')!='PASS':fail('CS01/CS07','narration violates the factual/natural contract '+z)
        if not 0<int(r.get('headlineCharacters',0))<=headline_limit(z) or not 0<int(r.get('subjectCharacters',0))<=headline_limit(z):fail('CS08','headline/subject limit '+z)
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
        if len(r.get('subject',''))>headline_limit(z) or len(r.get('headline',''))>headline_limit(z):fail('CS08','literal headline/subject limit '+z)
        for value in (r.get('headline',''),r.get('subject','')):validate_headline(value,z,r.get('neighborhoodNames'))
        for value in texts+r.get('youtubeDescriptions',[])+r.get('youtubeTitles',[]):validate_public_text(value,z)
        if len(r.get('youtubeTitles',[]))!=2 or any(len(t)>100 for t in r['youtubeTitles']):fail('CS11','literal YouTube title limit '+z)
        if len(r.get('youtubeDescriptions',[]))!=2:fail('CS11','both descriptions required '+z)
        for description in r['youtubeDescriptions']:
            lines=[' '.join(line.lower().split()) for line in description.splitlines() if line.strip()]
            if len(lines)!=len(set(lines)):fail('CS11','duplicate description lines '+z)
        if r.get('decode')!='PASS':fail('CS13','full media decode required '+z)
    layouts=contract.get('browser',[])
    if len(layouts)<12:fail('CS13','six HTML assets at desktop and mobile widths required')
    for result in layouts:
        validate_public_text(result.get('customerText',''),result.get('file','HTML'))
        for value in result.get('headlines',[]):validate_headline(value)
        if result.get('embedReport'):
            validate_public_text(result['embedReport'].get('customerText',''),'actual embed report')
            validate_headline(result['embedReport'].get('heading',''))
        if result.get('whiteCards')!=1 or result.get('boxedSections')!=0 or not result.get('grayBackground'):fail('CS10','one white card on gray required: '+result.get('file','unknown'))
        if result.get('file')=='9-blog-embed.html':
            for view in [result]+([result['embedReport']] if result.get('embedReport') else []):
                if any(view.get(key) is not True for key in ('embedHeaderAbsent','signupInsideCard','signupMatchesCardWidth','signupStaysAtCardTop')):fail('CS10','embed signup must stay inside its card, at card width, without a global header')
        elif not result.get('file','').startswith(('7-email','8-email')) and (result.get('signupStaysAtTop') is not True or result.get('headerScrollsAway') is not True or result.get('signupStartsBelowHeader') is not True):fail('CS10','header must scroll away and signup stay at the viewport top: '+result.get('file','unknown'))
        validate_reader_cta(result.get('customerText',''),result.get('file','HTML'))
        if result.get('embedReport'):validate_reader_cta(result['embedReport'].get('customerText',''),'actual embed report')
        if result.get('overflow') or result.get('brokenImages'):fail('CS10','broken/overflowing layout: '+result.get('file','unknown'))
    if contract.get('actualAgentEmbed') is not True:fail('CS10','actual drop-in agent embed required')
    return contract


def report_source_fingerprints(fingerprints):
    """Legal copy, admin-only reporting, and this audit tool render no monthly assets.

    Keep every report/template/data/prompt fingerprint and every rendered artifact
    comparison intact. A legal-policy edit must not require a new report baseline.
    """
    non_report={'re-data':{'src/components/LegalPage.tsx','content_gate.py','scripts/content_gate.py',
        'src/components/AdminPanel.tsx','src/components/AdminOutbound.tsx',
        'src/lib/outbound.ts','src/lib/outbound-model.ts',
        'supabase/functions/_shared/aa-outbound-provider.ts',
        'supabase/functions/aa-outbound-sync/index.ts',
        'src/components/AdminYouTubeFormats.tsx','public/visit-attribution.js','public/visit-attribution.d.ts',
        'supabase/functions/_shared/signup-attribution.ts','supabase/functions/_shared/youtube-video-analytics.ts',
        'supabase/functions/track-youtube-visit/index.ts'},
        'aa-blog':{'content_gate.py','scripts/content_gate.py'}}
    # Exact admin-route-only App revision. Other router/public-page changes still block.
    admin_route_alias={
        '7d7ff1c364261f81d3ad523d9a9d422ad92545360edbd4114d3d56d4f9abf9ef':
        '981c1c415eb0ee7a8eae59b922f394e2a51807387b2ee18d1a4df60519e75970'}
    # Exact revisions add only visit payloads or admin analytics, never report content.
    acquisition_aliases = {('re-data', 'src/main.tsx'): {'0bf1ad986c289ca39814b16edb2e8bf16708aca2acb040b6f816f919054853c5': '832842269af94b055b2cd42fd27a0f212773b36d20083b631b863cbb5f0fd09e'}, ('re-data', 'src/components/SignupFlow.tsx'): {'2d7b90b1c6582f0b0fdaf40010d270cf9dd0b9abd37394c7901ad1fc828e2421': 'cfb2d141e800b8d76d89618bd6324b291987f3e4a08916f3631eebd7cd5af778'}, ('re-data', 'src/components/ConsumerPage.tsx'): {'71cb093f94dcb559af3a47c8a308c1ee9ab071fd2036411683412b3be824083c': 'ef40d640b49017465d29c7ae96db3bcdb6c0996f9bb769147e68a15b7cc2a7f0'}, ('re-data', 'supabase/functions/subscribe-zip/index.ts'): {'15a14ae2899d9401d92e946cb86df7211c8fb880cc17d9ba00491dc9360ef8a2': '306e4c67948521650dc47b34c4c17a51bfc923d22a56062dbdebf48a7faffb69'}, ('re-data', 'supabase/functions/subscribe/index.ts'): {'dfe02e1b89a2cf8c3aacae4fc02be2c9abfa3a463b5b9e7d3d7640b91933d2a5': 'd90121927da9311b43e52fc9507d89f27492d7ce630d258d010f0f5b33d21dc1'}, ('re-data', 'supabase/functions/county-analytics-sync/index.ts'): {'a94d7b46e010e97b0511aeed5ac8ce7dd96f1ea39d357ccabba4d526cab10ba7': '3149c66234eea469ee28bf9e2976479ccdc844b01268788cd26e514b9f08e12a'}, ('aa-blog', 'public/embed/report-kit/controller.js'): {'8894120747e402ae8fd819cfe55561512133c8ac576652d554c39aa3d2cb3eee': '35945b201613955d80789b1425f77df36db521c3cc745ce269768d2ead25455d'}, ('aa-blog', 'public/embed.js'): {'a338f0270dbb3e412de3179bec1254338bd9d0075b30dbb8c5d7da11d7908233': 'e31da88bc0992afe8aa2ff52b1008df1264d3664991df95d09f7ed5842528667'}}
    return {repo:{name:acquisition_aliases.get((repo,name),{}).get(value,
                       admin_route_alias.get(value,value) if repo=='re-data' and name=='src/App.tsx' else value)
                  for name,value in files.items() if name not in non_report.get(repo,set())}
            for repo,files in fingerprints.items()}



def compare_baseline(approved, current):
    validate_contract(current)
    # Exact approved semantic/render evidence is deliberately stricter than a
    # tolerance that could hide an unrequested layout, voice or wording change.
    for facet in ('aiVersions','contentFingerprints','renderInputs','videoExact','normalizedEmbedSha256','copy','layout','charts','voices','metadata'):
        expected=approved.get(facet);actual=current.get(facet)
        if facet=='contentFingerprints':
            expected=report_source_fingerprints(expected or {})
            actual=report_source_fingerprints(actual or {})
        if facet not in approved or actual!=expected:fail('CS14','unapproved change in '+facet+'; review and explicit approval required')
    validate_similarity(approved,current)
    for filename in FILES:
        if not filename.endswith('.mp4') and filename!='9-blog-embed.html' and current['files'][filename]!=approved['files'][filename]:
            fail('CS14','unapproved byte change: '+filename)


def verify_baseline(repo, *, repos=None, customer_repo=None, deps=None, chrome=None):
    """Read-only verification. There is deliberately no approve/update option."""
    repo=Path(repo).resolve();parent=Path(repos or repo.parent).resolve()
    customer=Path(customer_repo or parent/'customer_housing_analysis').resolve()
    candidates=[parent/'aa-video-pipeline',customer,parent/'re-data',parent/'aa-blog']
    baseline=repo/'approved-content-baseline';manifest=baseline/'manifest.json'
    if not manifest.is_file():fail('CS14','explicit approved baseline missing; deployment blocked')
    approved=json.loads(manifest.read_text())
    if approved.get('approvalStatus')!='user-approved' or not approved.get('approval',{}).get('explicitUserApproval'):
        fail('CS14','baseline requires explicit user approval')
    for candidate in candidates:
        other=candidate/'approved-content-baseline/manifest.json'
        if not other.is_file() or sha(other)!=sha(manifest):fail('CS14','approved baseline copies disagree: '+candidate.name)
    for filename in FILES:
        p=baseline/filename
        if not p.is_file() or sha(p)!=approved.get('files',{}).get(filename):fail('CS14','approved file missing or changed: '+filename)
    inputs=baseline/'render-inputs'
    if not inputs.is_dir() or input_hashes(inputs)!=approved.get('inputFiles'):fail('CS14','approved render inputs missing or changed')
    if input_hashes(baseline/'video-evidence')!=approved.get('videoEvidenceFiles'):fail('CS14','approved video evidence missing or changed')
    if ai_versions(candidates)!=approved.get('aiVersions'):fail('Part I','prompt/model/settings/examples changed without user approval')
    video=parent/'aa-video-pipeline';runner=video/'scripts/render_content_review.py'
    if not runner.is_file():fail('CS13','committed review renderer required in sibling video checkout')
    # Check source before expensive rendering. Ignore the baseline itself to
    # avoid a manifest hashing its own hash; the assets/inputs are checked above.
    import importlib.util
    spec=importlib.util.spec_from_file_location('baseline_review_renderer',runner)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    if report_source_fingerprints(module.content_fingerprints(candidates))!=report_source_fingerprints(approved.get('contentFingerprints',{})):fail('CS14','candidate source changed; explicit review approval required')
    with tempfile.TemporaryDirectory(prefix='aa-content-predeploy-') as temporary:
        output=Path(temporary)/'rendered'
        evidence=Path(temporary)/'evidence'
        render_inputs=render_input_copy(inputs,Path(temporary)/'inputs')
        command=[sys.executable,str(runner),'--inputs',str(render_inputs),'--output',str(output),'--repos',str(parent),'--customer-repo',str(customer),'--evidence-output',str(evidence)]
        if deps:command+=['--deps',str(deps)]
        if chrome:command+=['--chrome',str(chrome)]
        subprocess.run(command,check=True)
        current=json.loads((output/'content-contract.json').read_text())
        current['normalizedEmbedSha256']=hashlib.sha256(normalized_embed((output/'9-blog-embed.html').read_text()).encode()).hexdigest()
        # Bind comparison to the exact files the renderer consumed, then compare
        # S3 objects by bucket/key rather than transport URL spelling/signatures.
        for name,value in current['renderInputs'].items():
            if sha(render_inputs/name)!=value:fail('CS14','rendered input hash mismatch: '+name)
        current['renderInputs']={name:comparison_sha(render_inputs/name) for name in current['renderInputs']}
        current['videoSSIM']={name:video_similarity(baseline/name,output/name,
            fps=approved['videoExact'][name]['composition']['fps'],
            frames=approved['videoExact'][name]['composition']['durationInFrames'])
            for name in FILES if name.endswith('.mp4')}
        compare_baseline(approved,current)
    if input_hashes(inputs)!=approved['inputFiles']:fail('CS14','renderer mutated approved inputs')
    print('PASS approved baseline: exact audio/scenes/text/props; every 1fps SSIM >=0.99; six text files byte-identical; embed exact except generated paths/hash and approved CS08 validator deltas; prompts/models unchanged')
    return current


def predeploy(repo=None, *, chrome=None):
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
    for candidate in (repo.parent/name for name in REPOS):
        if not candidate.is_dir():fail('CS13','all four sibling candidate checkouts required')
        for args in (['diff','--name-only'],['diff','--cached','--name-only']):
            if subprocess.check_output(['git',*args],cwd=candidate,text=True).strip():fail('CS13','commit and push before deploying: '+candidate.name)
        head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=candidate,text=True).strip()
        branch=subprocess.check_output(['git','branch','--show-current'],cwd=candidate,text=True).strip()
        remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/'+branch],cwd=candidate,text=True).split()
        if not remote or remote[0]!=head:fail('CS13','commit is not pushed: '+candidate.name)
    # Select the audited browser executable without weakening any comparison.
    verify_baseline(repo,chrome=chrome or os.environ.get('CONTENT_GATE_CHROME'))
    print('PASS CONTENT_STANDARD: both ZIPs re-rendered; approved baseline unchanged')


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify',action='store_true',help='verify without deploying or changing approval')
    parser.add_argument('--repos',type=Path)
    parser.add_argument('--customer-repo',type=Path)
    parser.add_argument('--deps',type=Path)
    parser.add_argument('--chrome')
    args=parser.parse_args()
    try:
        if args.verify:verify_baseline(Path(__file__).resolve().parent,repos=args.repos,customer_repo=args.customer_repo,deps=args.deps,chrome=args.chrome)
        else:predeploy(chrome=args.chrome)
    except (ValueError,KeyError,FileNotFoundError,subprocess.CalledProcessError) as error:
        print('DEPLOY BLOCKED — '+str(error),file=sys.stderr)
        raise SystemExit(1) from None
