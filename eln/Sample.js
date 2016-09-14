'use strict'
/**
 * Created by acastillo on 7/1/16.
 */
define([
    'file-saver',
    'src/util/api',
    'src/util/ui',
    'https://www.lactame.com/lib/openchemlib-extended/1.11.0/openchemlib-extended.js',
    'https://www.lactame.com/lib/chemcalc/3.0.6/chemcalc.js',
    'https://www.lactame.com/lib/eln-plugin/0.0.2/eln-plugin.js',
    'https://www.lactame.com/github/cheminfo-js/visualizer-helper/7f9c4d2c296389ed263a43826bafeba1164d13de/rest-on-couch/Roc.js'
], function (fileSaver, API, UI, OCLE, CC, elnPlugin, Roc) {

    var defaultOptions = {
        varName: 'sample',
        track: true
    };

    class Sample {
        constructor(couchDB, uuid, options) {
            this.options = Object.assign({}, defaultOptions, options);


            var roc = API.cache('roc');
            if (!roc) {
                roc = new Roc({
                    url: couchDB.url,
                    database: couchDB.database,
                    processor: elnPlugin,
                    kind: couchDB.kind
                });
                API.cache('roc', roc);
            }
            this.roc = roc;


            this.uuid = uuid;
            if (!this.uuid) {
                UI.showNotification("Cannot create an editable sample without an uuid", 'error');
                return;
            }
            this._loadInstanceInVisualizer();
        }

        _loadInstanceInVisualizer() {
            this.roc.document(this.uuid, {
                varName: this.options.varName
            }).then(sample => {
                this.sample = sample;
                var sampleVar = API.getVar(this.options.varName);
                API.setVariable('sampleCode', sampleVar, ['$id', 0]);
                API.setVariable('batchCode', sampleVar, ['$id', 1]);
                API.setVariable('creationDate', sampleVar, ['$creationDate']);
                API.setVariable('modificationDate', sampleVar, ['$modificationDate']);
                API.setVariable('content', sampleVar, ['$content']);
                API.setVariable('molfile', sampleVar, ['$content', 'general', 'molfile']);
                API.setVariable('mf', sampleVar, ['$content', 'general', 'mf']);
                API.setVariable('mw', sampleVar, ['$content', 'general', 'mw']);
                API.setVariable('description', sampleVar, ['$content', 'general', 'description']);
                API.setVariable('iupac', sampleVar, ['$content', 'general', 'iupac']);
                API.setVariable('bp', sampleVar, ['$content', 'physical', 'bp']);
                API.setVariable('nd', sampleVar, ['$content', 'physical', 'nd']);
                API.setVariable('mp', sampleVar, ['$content', 'physical', 'mp']);
                API.setVariable('density', sampleVar, ['$content', 'physical', 'density']);
                API.setVariable('nmr', sampleVar, ['$content', 'spectra', 'nmr']);
                API.setVariable('ir', sampleVar, ['$content', 'spectra', 'ir']);
                API.setVariable('mass', sampleVar, ['$content', 'spectra', 'mass']);
                this.updateAttachments(sample);

                sample.onChange((event) => {
                    if (typeof IframeBridge !== 'undefined') {
                        IframeBridge.postMessage('tab.status', {
                            saved: false
                        });
                    }

                    console.log("change event received", event.jpath.join('.'), event);

                    switch (event.jpath.join('.')) {
                        case 'general.molfile':

                            break;
                        case 'general.mf':

                            break;
                    }
                });

                if (typeof OCLE != 'undefined' && this.options.track) {
                    var expandableMolecule = new ExpandableMolecule(sample);
                    API.cache('expandableMolecule', expandableMolecule);
                }
            });
        }

        updateAttachments(entry) {
            return this.roc.getAttachmentList(this.uuid).then(function (list) {
                API.createData('sampleAttachments', list);
            })
        }


        handleAction(action) {
            if (!action) return;

            switch (action.name) {
                case 'refresh':
                    this.roc.get(this.uuid);
                    break;
                case 'save':
                    this.roc.update(this.sample).then(function () {
                        if (typeof IframeBridge != 'undefined') {
                            IframeBridge.postMessage('tab.status', {
                                saved: true
                            });
                        }
                    });
                    break;

                case 'toggleJSMEEdition':
                    API.cache("expandableMolecule").toggleJSMEEdition();
                    break;
                case 'clearMolfile':
                    var molfile=API.getData('editableMolfile');
                    molfile.setValue('');
                    break;
                case 'swapHydrogens':
                    API.cache("expandableMolecule").setExpandedHydrogens();
                    break;
                case 'toggleAdvancedOptions1H':
                    API.cache('advancedOptions1H', ! API.cache('advancedOptions1H'));
                case 'createOptions':
                    var advancedOptions1H = API.cache("advancedOptions1H");
                    if (advancedOptions1H) {
                        API.createData("onde", API.getData("ondeOptions").full);
                    } else {
                        API.createData("onde", API.getData("ondeOptions").short);
                    }
                    break;
                case 'downloadSVG':
                    var blob = new Blob([this.action.value+""], {type: "application/jcamp-dx;charset=utf-8"});
                    fileSaver(blob, 'spectra.svg');
                    break;

                case 'deleteAttachment':
                    var attachment = action.value.name;
                    this.roc.deleteAttachment(sample, attachment).then(this.updateAttachments);
                    break;
                case 'deleteSpectra':
                    this.roc.unattach(sample, action.value).then(this.updateAttachments);
                    break;
                case 'attachNMR':
                case 'attachIR':
                case 'attachMass':
                    var type = action.name.replace("attach", "").toLowerCase();
                    var droppedDatas = data;
                    droppedDatas = droppedDatas.file || droppedDatas.str;
                    var prom = Promise.resolve();
                    for (let i = 0; i < droppedDatas.length; i++) {
                        prom = prom.then(() => {
                            var data = DataObject.resurrect(droppedDatas[i]);
                            return this.roc.attach(type, sample, data);
                        });
                    }

                    prom.then(() => {
                        this.updateAttachments(sample);
                    }).catch(() => {
                        this.updateAttachments(sample);
                    });
                    break;
                default:
                    break
            }
        }
    }

    class ExpandableMolecule {
        constructor(sampleIn) {
            this.sample = sampleIn;
            this.molfile = this.sample.$content.general.molfile + '';
            var molecule = OCLE.Molecule.fromMolfile(this.molfile);
            this.idCode = molecule.getIDCode();
            this.expandedHydrogens = false;
            this.jsmeEditionMode = false;
            API.createData('editableMolfile', this.molfile).then(
                (editableMolfile) => {
                    editableMolfile.onChange( (event) => {
                        // us this really a modification ? or a loop event ...
                        // need to compare former oclID with new oclID
                        var idCode = OCLE.Molecule.fromMolfile(event.target + '').getIDCode();
                        if (idCode != this.idCode) {
                            this.idCode = idCode;
                            this.molfile = event.target + '';
                            this.sample.setChildSync('$content.general.molfile', this.molfile);
                        } else {
                            console.log('no update');
                        }

                        // by default we would like the depict mode
                        this.updateMolfiles();
                        this.updateMF();
                    });
                    this.updateMolfiles();
                    this.toggleJSMEEdition(false);
                }
            );
        }

        toggleJSMEEdition(force, noDepictUpdate) {
            if (force !== undefined && force === this.jsmeEditionMode) return;
            if (force === undefined) {
                this.jsmeEditionMode = !this.jsmeEditionMode;
            } else {
                this.jsmeEditionMode = force;
            }
            var prefs = {
                "prefs": [
                    "oldlook",
                    "nozoom"
                ],
                "labelsize": "14",
                "bondwidth": "1",
                "defaultaction": "105",
                "highlightColor": "3",
                "outputResult": [
                    "yes"
                ]
            };

            if (this.jsmeEditionMode) {
                API.getData("editableMolfile").triggerChange();
                this.expandedHydrogens = false;
            } else {
                prefs.prefs.push('depict');
                if (!noDepictUpdate) {
                    this.expandedHydrogens = false;
                    API.createData("viewMolfile", this.viewMolfile);
                }

            }
            API.doAction('setJSMEPreferences', prefs)
        }

        setExpandedHydrogens(force) {
            if (force === undefined) {
                this.expandedHydrogens = !this.expandedHydrogens;
            } else {
                this.expandedHydrogens = force;
            }
            if (this.expandedHydrogens) {
                API.createData("viewMolfileExpandedH", this.viewMolfileExpandedH);
                this.toggleJSMEEdition(false, true);
            } else {
                API.createData("viewMolfile", this.viewMolfile);
            }
        }

        updateMolfiles() {
            // prevent the loop by checking actelionID
            var molecule = OCLE.Molecule.fromMolfile(this.molfile);
            this.viewMolfile = molecule.toVisualizerMolfile();

            molecule.addImplicitHydrogens();
            this.viewMolfileExpandedH = molecule.toVisualizerMolfile();
            this.mf = molecule.getMolecularFormula().formula;
            this.mw = molecule.getMolecularFormula().relativeWeight;
            this.nH = molecule.getNumberOfAtoms('H');
        }

        updateMF() {
            if (typeof UI != 'undefined')
                UI.showNotification('Updated mf and mw', 'info');
            this.sample.$content.general.molfile = this.molfile;
            this.sample.$content.general.mf = this.mf;
            this.sample.$content.general.mw = this.mw;
        }
    }

    return Sample;
});

