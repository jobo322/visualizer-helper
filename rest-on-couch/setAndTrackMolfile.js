
require(['src/util/api'], function(API) {
    if (typeof IframeBridge != 'undefined') {
        require(['Roc','Sample'], function(Roc, Sample) {
            IframeBridge.onMessage(onMessage);
            IframeBridge.ready();
            function onMessage(data) {
                if(data.type === 'tab.data' || data.type === 'tab.focus') {
                    var roc = new Roc({
                        url: data.message.couchUrl,
                        database: data.message.database
                    });
                    var sample = new Sample(roc, data.message.uuid, 'sample', {track:false});
                }
                
            }
        });
    } else {
        // we retrieve the cache if it exists
        var externalInfo = JSON.parse(window.localStorage.getItem('external_cache') || "{}");
        var smiles = externalInfo.smiles;
        var molfile = externalInfo.molfile;
        var nmr = API.createData('nmr',[]);    
        
        require(["uri/URI"], function(URI) {
            var uri = new URI(document.location.href);
            var search = uri.search(true);
            if (search.smiles) {
                smiles=search.smiles;
            }
            
            if (molfile) {
                require(["OCLE"], function (OCLE) {
                    var molecule=OCLE.Molecule.fromMolfile(molfile);
                    API.createData('molfile', molecule.toMolfile());
                });
            } else if(smiles) {
                require(["OCLE"], function (OCLE) {
                    var molecule=OCLE.Molecule.fromSmiles(smiles);
                    API.createData('molfile', molecule.toMolfile());
                });
            } else {
                molfile=window.localStorage.getItem('molfile');
                if (molfile) {
            		API.createData('molfile', molfile);
            	} else {
            	    API.createData('molfile', '');
            	}
            }
         })
        
        var data = require('src/util/versioning').getData();
        data.onChange(function (evt) {
            if(evt.jpath.length==1 && evt.jpath[0]=='molfile') {
                localStorage.setItem('molfile', evt.target.get());
            }
        });
    }
})