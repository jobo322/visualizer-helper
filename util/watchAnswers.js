/*
In the general preferences you should put something like:
require(['TrackOptions'], function(TrackOptions) {
    TrackOptions('massOptions');
})
*/

define([], function () {
    function watchAnswers(cookieName, exercises) {
        var myAnswers = JSON.parse(window.localStorage.getItem(cookieName) || "{}");

        for (var i=0; i<exercises.length; i++) {
            var exercise=exercises[i];
            var myAnswer=myAnswers[exercise.id];
            if (myAnswer) {
                exercise.myResult=myAnswer;
            }
        }

        exercises.onChange(function (evt) {
            switch (evt.target.__name) {
                case 'myResult':
                    var target=evt.target.__parent;
                    if (target) {
                        myAnswers[target.id]=target.myResult;
                    }
                    break;
                case 'exercises':
                    myAnswers={};
            }
            window.localStorage.setItem(cookieName, JSON.stringify(myAnswers));
        });
    }
    return watchAnswers;
});

