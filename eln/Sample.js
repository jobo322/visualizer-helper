'use strict'
/**
 * Created by acastillo on 7/1/16.
 */
define([
    './ExpandableMolecule',
    './Nmr1dManager',
    './MF',
    'src/util/api',
    'src/util/ui',
    'src/util/debug',
    'lodash',
    './libs'
 ], function (ExpandableMolecule, Nmr1dManager, MF, API, UI, Debug, _, libs) {
    var elnPlugin = libs.elnPlugin;
    var Roc = libs.Roc;
    

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


    //        this._mfDebouched=_.debounce(this.updateMF, 2000).bind(this);

        }

        _loadInstanceInVisualizer() {
            this.roc.document(this.uuid, this.options).then(sample => {
                this.sample = sample;
                var sampleVar = API.getVar(this.options.varName);
                API.setVariable('sampleCode', sampleVar, ['$id', 0]);
                API.setVariable('batchCode', sampleVar, ['$id', 1]);
                API.setVariable('creationDate', sampleVar, ['$creationDate']);
                API.setVariable('modificationDate', sampleVar, ['$modificationDate']);
                API.setVariable('content', sampleVar, ['$content']);
                API.setVariable('general', sampleVar, ['$content', 'general']);
                API.setVariable('molfile', sampleVar, ['$content', 'general', 'molfile']);
                API.setVariable('mf', sampleVar, ['$content', 'general', 'mf']);
                API.setVariable('mw', sampleVar, ['$content', 'general', 'mw']);
                API.setVariable('em', sampleVar, ['$content', 'general', 'em']);
                API.setVariable('description', sampleVar, ['$content', 'general', 'description']);
                API.setVariable('iupac', sampleVar, ['$content', 'general', 'iupac']);
                API.setVariable('bp', sampleVar, ['$content', 'physical', 'bp']);
                API.setVariable('nd', sampleVar, ['$content', 'physical', 'nd']);
                API.setVariable('mp', sampleVar, ['$content', 'physical', 'mp']);
                API.setVariable('density', sampleVar, ['$content', 'physical', 'density']);
                API.setVariable('ir', sampleVar, ['$content', 'spectra', 'ir']);
                API.setVariable('mass', sampleVar, ['$content', 'spectra', 'mass']);

                this.updateAttachments(sample);

                this.expandableMolecule = new ExpandableMolecule(this.sample);
                this.nmr1dManager = new Nmr1dManager();
                this.nmr1dManager.initializeNMRAssignment(this.sample.getChildSync(['$content', 'spectra', 'nmr']));
                API.setVariable('nmr', sampleVar, ['$content', 'spectra', 'nmr']);

                this.mf = new MF(this.sample);
                this.mf.fromMF();

                this.onChange = (event) => {
                    if (typeof IframeBridge !== 'undefined') {
                        IframeBridge.postMessage('tab.status', {
                            saved: false
                        });
                    }

                    console.log("change event received", event.jpath.join('.'), event);
                    var jpathStr = event.jpath.join('.');


                    if (jpathStr.replace(/\.\d+\..*/,'')==='$content.spectra.nmr') {
                        // execute peak picking
                        console.log('range changed, execute peak picking');
                        var currentNmr = this.sample.getChildSync(jpathStr.replace(/(\.\d+)\..*/, '$1').split('.'));
                        this.nmr1dManager.executePeakPicking(currentNmr);
                        this.nmr1dManager.updateIntegrals();
                        // we are changing NMR ...
                        // if there is no assignment we should recalculate it

                        // we should check that the integrals are correct
                    }


                    switch (event.jpath.join('.')) {
                        case '':
                            this.nmr1dManager.initializeNMRAssignment(this.sample.getChildSync(['$content', 'spectra', 'nmr']));
                            API.setVariable('nmr', sampleVar, ['$content', 'spectra', 'nmr']);
                            break;
                        case '$content.general.molfile':
                            this.mf.fromMolfile();
                            break;
                        case '$content.general.mf':
                            try {
                                this.mf.fromMF();
                                this.nmr1dManager.updateIntegral();
                            } catch(e) {console.log('ignore error', e)}
                            break;
                    }
                };

                this.bindChange();
            });
        }

        bindChange() {
            this.sample.unbindChange(this.onChange);
            this.sample.onChange(this.onChange);
        }

        unbindChange() {
            this.sample.unbindChange(this.onChange);
        }



        updateAttachments(entry) {
            return this.roc.getAttachmentList(this.uuid).then(function (list) {
                API.createData('sampleAttachments', list);
            })
        }

        handleDrop(name) {
            if(!name) {
                throw new Error('handleDrop expects a variable name');
            }
            name = String(name);
            // maps name of variable to type of data
            var types = {
                'droppedNmr': 'nmr',
                'droppedIR': 'ir',
                'droppedMS': 'mass'
            };

            if(!types[name]) {
                throw new Error('Unexpected variable name');
            }

            // Dropped data can be an array
            // Expecting format as from drag and drop module
            var droppedDatas = API.getData(name);
            droppedDatas = droppedDatas.file || droppedDatas.str;
            var prom = Promise.resolve();
            for(let i=0; i<droppedDatas.length; i++) {
                prom = prom.then(() => {
                    var data = DataObject.resurrect(droppedDatas[i]);
                    return this.roc.attach(types[name], this.sample, data);
                });
            }

            prom.then(() => {
                this.updateAttachments();
            }).catch(err =>  {
                Debug.error('Error in handle drop', err);
                // Even if it failed it could be that some of them succeeded
                this.updateAttachments();
            });
        }

        handleAction(action) {
            if (!action) return;

            if (this.expandableMolecule && this.expandableMolecule.handleAction(action)) return;
            if (this.nmr1dManager && this.nmr1dManager.handleAction(action)) return;

            switch (action.name) {
                case 'save':
                    this.roc.update(this.sample).then(function () {
                        if (typeof IframeBridge != 'undefined') {
                            IframeBridge.postMessage('tab.status', {
                                saved: true
                            });
                        }
                    });
                    break;
                case 'createOptions':
                    var advancedOptions1H = API.cache("nmr1hAdvancedOptions");
                    if (advancedOptions1H) {
                        API.createData("nmr1hOndeTemplate", API.getData("nmr1hOndeTemplates").full);
                    } else {
                        API.createData("nmr1hOndeTemplate", API.getData("nmr1hOndeTemplates").short);
                    }
                    break;
                case 'deleteAttachment':
                    var attachment = action.value.name;
                    this.roc.deleteAttachment(this.sample, attachment).then(this.updateAttachments.bind(this));
                    break;
                case 'deleteNmr':
                    this.roc.unattach(this.sample, action.value).then(this.updateAttachments.bind(this));
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
                case 'refresh':
                    UI.confirm('Are you sure you want to refresh? This will discard your local modifications.').then(ok => {
                        if(!ok) return;
                        this.unbindChange();
                        this.roc.discardLocal(this.sample).then(() => this.bindChange());
                        IframeBridge.postMessage('tab.status', {
                            saved: true
                        });
                    });

                    break;
                default:
                    break
            }
        }
    }

    return Sample;
});

