// Content script pour gérer les interactions avec la page
console.log('🔧 Auto Click Timer Extension - Content script chargé');

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clickElement') {
        const success = clickElement(request.selector);
        sendResponse({success: success});
    }
    
    if (request.action === 'checkElement') {
        const exists = checkElementExists(request.selector);
        sendResponse({exists: exists});
    }
});

// Fonction pour vérifier si un élément existe
function checkElementExists(selector) {
    let element;
    
    // Essayer XPath
    if (selector.startsWith('//') || selector.startsWith('/')) {
        try {
            element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (e) {
            // Ignorer l'erreur XPath
        }
    }
    
    // Essayer CSS selector
    if (!element) {
        try {
            element = document.querySelector(selector);
        } catch (e) {
            // Ignorer l'erreur CSS
        }
    }
    
    return !!element;
}

// Fonction pour cliquer sur un élément
function clickElement(selector) {
    let element;
    
    // Essayer d'abord comme XPath
    if (selector.startsWith('//') || selector.startsWith('/')) {
        try {
            element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (e) {
            console.log('❌ XPath failed, trying CSS selector');
        }
    }
    
    // Si XPath échoue, essayer comme CSS selector
    if (!element) {
        try {
            element = document.querySelector(selector);
        } catch (e) {
            console.error('❌ CSS selector failed:', e);
        }
    }
    
    if (element) {
        // S'assurer que l'élément est visible
        element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
        });
        
        // Attendre que le défilement se termine
        setTimeout(() => {
            try {
                // Simuler une interaction utilisateur complète
                const rect = element.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                
                // Focus sur l'élément
                element.focus();
                
                // Créer et déclencher les événements de souris
                const mouseEvents = [
                    'mouseover',
                    'mouseenter', 
                    'mousedown',
                    'mouseup',
                    'click'
                ];
                
                mouseEvents.forEach((eventType, index) => {
                    setTimeout(() => {
                        const event = new MouseEvent(eventType, {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            clientX: x,
                            clientY: y,
                            button: 0,
                            buttons: eventType === 'mousedown' ? 1 : 0
                        });
                        element.dispatchEvent(event);
                    }, index * 10);
                });
                
                // Clic direct en dernier recours
                setTimeout(() => {
                    element.click();
                }, 100);
                
                console.log('✅ Élément cliqué avec succès:', selector);
                
            } catch (error) {
                console.error('❌ Erreur lors du clic:', error);
            }
        }, 500);
        
        return true;
    } else {
        console.error('❌ Élément non trouvé:', selector);
        return false;
    }
}

// Observer les changements DOM pour s'adapter aux sites dynamiques
const observer = new MutationObserver((mutations) => {
    // Peut être utilisé pour réagir aux changements de la page
    // if needed for dynamic content handling
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
});

// Nettoyer lors du déchargement de la page
window.addEventListener('beforeunload', () => {
    observer.disconnect();
});

// Indiquer que le content script est prêt
window.autoClickTimerReady = true;