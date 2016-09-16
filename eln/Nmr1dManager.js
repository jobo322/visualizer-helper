'use strict'

define([
    'file-saver',
    'src/util/api',
    'src/util/ui',
    './libs'
] , function (fileSaver, API, UI, libs) {

    var SD=libs.SD;
    var CCE=libs.CCE;
    
    class Nmr1dManager {
        constructor() {
           
        }

        handleAction(action) {
            switch (action.name) {
                case 'downloadSVG':
                    var blob = new Blob([action.value+""], {type: "application/jcamp-dx;charset=utf-8"});
                    fileSaver(blob, 'spectra.svg');
                    break;
                case 'toggleNMR1hAdvancedOptions':
                    var advancedOptions1H = ! API.cache("nmr1hAdvancedOptions");
                    API.cache("nmr1hAdvancedOptions", advancedOptions1H);
                    if (advancedOptions1H) {
                        API.createData("nmr1hOndeTemplate", API.getData("nmr1hOndeTemplates").full);
                    } else {
                        API.createData("nmr1hOndeTemplate", API.getData("nmr1hOndeTemplates").short);
                    }

                    break;
                case 'resetNMR1d':
                case 'resetNMR1d':
                    var type = action.name.replace(/[^0-9]/g,'');

                    type = type + 'd';
                    API.createData('blackNMR' + type, null);
                    API.createData('annotationNMR' + type, null);
                    API.createData('acsNMR' + type, null);
                    break;
                case 'executePeakPicking':
                    // the action may be generated by clicking on a line or clicking on the button to
                    // recalculate the peak picking.
                    console.log('executePeakPicking);')
                    var currentNmr;
                    // if we click on a line, the action will be throw with the current NMR
                    if (action.value.dimension) {
                        currentNmr = action.value;
                        if (currentNmr.dimension>1) {
                            if (this.blackNMR2d !== currentNmr.jcamp) {
                                API.createData('blackNMR2d', currentNmr.jcamp.data);
                                this.blackNMR2d = currentNmr.jcamp;
                            }
                            // No peak picking currently for 2D
                            API.switchToLayer('nmr2D');
                            return;
                        } else {
                            if (this.blackNMR1d !== currentNmr.jcamp) {
                                API.createData('blackNMR1d', currentNmr.jcamp.data);
                                this.blackNMR1d = currentNmr.jcamp;
                            }
                            API.switchToLayer('Default layer');
                        }
                    } else { // we click on the button to redo assignment
                        currentNmr = API.getData('currentNmr');
                        if (currentNmr.dimension>1) {
                            if (typeof UI != "undefined") {
                                UI.showNotification('Peak picking can only be applied on 1D spectra','warning');
                            }
                            return;
                        }
                    }
                    console.log('action.value', action.value)
                    if (action.value.integral){//Fired from button
                        this._doAssignment(currentNmr);
                    } else {
                        console.log('currentNmr', currentNmr);
                        if(!currentNmr.range || ! currentNmr.range.length) {
                            this._doAssignment(currentNmr);
                            // } else {
                            // API.setVariable("editedRange",API.getVariable('currentNmr'),["range"]);
                        } else {
                            this._createNMRannotationsAndACS(currentNmr);
                        }
                    }
                    break;
                default:
                    return false;
            }
            return true;
        }


        _doAssignment(currentNmr) {
            currentNmr.getChild(['jcamp', 'data']).then((jcamp) => {
                jcamp = String(jcamp.get());
                var ppOptions = API.getData("nmr1hOptions").resurrect();
                var spectrum = SD.NMR.fromJcamp(jcamp);
                var intFN = 0;
                if(ppOptions.integralFn=="peaks"){
                    intFN=1;
                }
                var peakPicking = spectrum.nmrPeakDetection({
                    nH:ppOptions.integral,
                    realTop:true,
                    thresholdFactor:ppOptions.noiseFactor,
                    clean:ppOptions.clean,
                    compile:ppOptions.compile,
                    optimize:ppOptions.optimize,
                    integralFn:intFN,
                    idPrefix:spectrum.getNucleus()+"",
                    gsdOptions:{minMaxRatio:0.001, smoothY:false, broadWidth:0},
                    format:"new"
                });
                currentNmr.setChildSync(['range'], peakPicking);
                this._createNMRannotationsAndACS(currentNmr);
            });
        }


        _createNMRannotationsAndACS(currentNmr) {
            console.log('create annoations');
            var peakPicking = JSON.parse(JSON.stringify(API.getData("currentNmrRanges")));
    
            //Recompile multiplicity
            for (var i=0; i<peakPicking.length; i++){
                var peak = peakPicking[i];
                for (var j=0; j<peak.signal.length; j++){
                    var signal = peak.signal[j];
                    if (signal.j && ! signal.multiplicity) {
                        signal.multiplicity = "";
                        for (var k=0; k<signal.j.length;k++){
                            signal.multiplicity+=signal.j[k].multiplicity;
                        }
                    }
                }
            }
    
            API.createData("annotationsNMR1d", SD.GUI.annotations1D(peakPicking, {
                line:1,
                fillColor:"green",
                strokeWidth:0
            }));
            API.createData("acsNMR1d",SD.formatter.toACS(peakPicking, {
                rangeForMultiplet:true,
                nucleus:currentNmr.nucleus[0],
                observe:Math.round(currentNmr.frequency/10)*10
            }));
        }

        updateIntegral() {
            var chemcalc=CCE.analyseMF(API.getData('mf')+'');
            if (chemcalc && chemcalc.atoms && chemcalc.atoms.H) {
                var nmr1hOptions=API.getData('nmr1hOptions');
                if (nmr1hOptions) nmr1hOptions.integral=this.chemcalc.atoms.H;
                nmr1hOptions.triggerChange();
            }
        }

        initializeNMRAssignment() {
            var promise = Promise.resolve();
            promise = promise.then(() => API.createData('nmr1hOptions', {
                    "noiseFactor": 0.8,
                    "clean": true,
                    "compile": true,
                    "optimize": false,
                    "integralFn": "sum",
                    "integral": 30,
                    "type": "1H"
                })
            );

            promise=promise.then(() => API.createData('nmr1hOndeTemplates', {
                "full": {
                    "type": "object",
                    "properties": {
                        "integral": {
                            "type": "number",
                            "title": "value to fit the spectrum integral",
                            "label": "Integral"
                        },
                        "noiseFactor": {
                            "type": "number",
                            "title": "Mutiplier of the auto-detected noise level",
                            "label": "noiseFactor"
                        },
                        "clean": {
                            "type": "boolean",
                            "title": "Delete signals with integration less than 0.5",
                            "label": "clean"
                        },
                        "compile": {
                            "type": "boolean",
                            "title": "Compile the multiplets",
                            "label": "compile"
                        },
                        "optimize": {
                            "type": "boolean",
                            "title": "Optimize the peaks to fit the spectrum",
                            "label": "optimize"
                        },
                        "integralFn": {
                            "type": "string",
                            "title": "Type of integration",
                            "label": "Integral type",
                            "enum": [
                                "sum",
                                "peaks"
                            ]
                        },
                        "type": {
                            "type": "string",
                            "title": "Nucleus",
                            "label": "Nucleus",
                            "editable": false
                        }
                    }
                },
                "short": {
                    "type": "object",
                    "properties": {
                        "integral": {
                            "type": "number",
                            "title": "value to fit the spectrum integral",
                            "label": "Integral"
                        }
                    }
                }
            }));
            promise=promise.then((nmr1hOndeTemplates) => API.createData('nmr1hOndeTemplate', nmr1hOndeTemplates.short));
            return promise;
        }
    }
        

    return Nmr1dManager;
});

