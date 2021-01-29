window.addEventListener('DOMContentLoaded', (event) => {
    function setAnimationPosition(){
        document.documentElement.style.setProperty('--animation-position',
                                         document.documentElement.offsetWidth);
    }
    window.addEventListener('resize', setAnimationPosition);
    setAnimationPosition(); // initial
});
