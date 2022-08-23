import os
import sys
from pathlib import Path
from pylode import OntDoc
from bs4 import BeautifulSoup

def gen_doc(dir, name):
    od = OntDoc(ontology=dir / (name + '.ttl'))
    html = od.make_html()
    soup = BeautifulSoup(html, 'html.parser')
    rdflink = BeautifulSoup(f"""<div>
      <dt>Ontology RDF</dt>
      <dd><a href="../{name}.ttl">RDF (turtle)</a></dd>
    </div>""", 'html.parser')
    dl = soup.find(id="metadata").find("dl")
    dl.append(rdflink)
    Path(dir / name).mkdir(exist_ok=True)
    with open(dir / name / 'index.html', "w") as f:
        f.write(soup.prettify())

dir = Path(sys.path[0])
for file in os.listdir(dir):
    name, ext = os.path.splitext(file)
    if ext == '.ttl':
        gen_doc(dir, name)
