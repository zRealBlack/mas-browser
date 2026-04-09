const { ipcRenderer } = require('electron');

let creds = null;

// Request credentials for this domain
ipcRenderer.invoke('get-passwords', location.hostname).then(c => {
    creds = c;
    if (creds && creds.length > 0) {
        setTimeout(autoFill, 500);
        setTimeout(autoFill, 2000);
    }
});

function autoFill() {
    if (!creds || creds.length === 0) return;
    const passInputs = document.querySelectorAll('input[type="password"]');
    if (passInputs.length > 0) {
        const p = passInputs[0];
        const form = p.closest('form');
        if (form) {
            const u = form.querySelector('input[type="text"], input[type="email"]');
            if (u && !u.value) u.value = creds[0].user;
            if (p && !p.value) p.value = creds[0].pass;
        } else {
             // Fallback if no form
             const allInputs = Array.from(document.querySelectorAll('input'));
             const pIdx = allInputs.indexOf(p);
             for (let i = pIdx - 1; i >= 0; i--) {
                 if (allInputs[i].type === 'text' || allInputs[i].type === 'email') {
                     if (!allInputs[i].value) allInputs[i].value = creds[0].user;
                     break;
                 }
             }
             if (!p.value) p.value = creds[0].pass;
        }
    }
}

window.addEventListener('submit', (e) => {
    const pList = e.target.querySelectorAll('input[type="password"]');
    if (pList.length > 0) {
        const p = pList[0].value;
        const uIn = e.target.querySelector('input[type="text"], input[type="email"]');
        let u = uIn ? uIn.value : '';
        
        if (!u) {
             const allInputs = Array.from(e.target.querySelectorAll('input'));
             const pIdx = allInputs.indexOf(pList[0]);
             for (let i = pIdx - 1; i >= 0; i--) {
                 if (allInputs[i].type === 'text' || allInputs[i].type === 'email') {
                     u = allInputs[i].value;
                     break;
                 }
             }
        }
        
        if (p && u) {
            ipcRenderer.sendToHost('save-password', { user: u, pass: p, domain: location.hostname });
        }
    }
}, true);
