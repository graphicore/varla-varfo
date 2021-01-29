(function(){
function init() {
    function setAnimationPosition(){
        document.documentElement.style.setProperty('--animation-position-js',
                                         document.documentElement.offsetWidth);
    }
    window.addEventListener('resize', setAnimationPosition);
    setAnimationPosition(); // initial
}

if (document.readyState !== "loading")
    init();
else
    window.addEventListener('DOMContentLoaded', () => init());
})();
