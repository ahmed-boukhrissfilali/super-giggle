// Content script pour gérer les interactions avec la page
console.log('🔧 Auto Click Timer Extension - Content script chargé');

// État local pour la surveillance de la fenêtre
let windowEventState = {
    isVisible: true,
    lastVisibilityChange: Date.now(),
    focusLostCount: 0
};

// Écouter les messages du background et popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clickElement') {
        const success = clickElement(request.selector);
        sendResponse({success: success});
    }
    
    if (request.action === 'checkElement') {
        const exists = checkElementExists(request.selector);
        sendResponse({exists: exists});
    }
    
    if (request.action === 'executeFinalClicks') {
        console.log('🔥 Exécution des clics finaux demandée par le background');
        executeFinalClicks();
        sendResponse({success: true});
    }
    
    if (request.action === 'windowExitDetected') {
        console.log('🚪 Sortie de fenêtre détectée:', request.data);
        handleWindowExit(request.data);
        sendResponse({received: true});
    }
    
    if (request.action === 'windowReturnDetected') {
        console.log('🏠 Retour sur fenêtre détecté:', request.data);
        handleWindowReturn(request.data);
        sendResponse({received: true});
    }
});

// Surveiller la visibilité de la page
document.addEventListener('visibilitychange', () => {
    windowEventState.lastVisibilityChange = Date.now();
    
    if (document.hidden) {
        windowEventState.isVisible = false;
        windowEventState.focusLostCount++;
        console.log('👁️ Page masquée - L\'utilisateur a quitté cet onglet');
        
        // Notifier le background de la perte de focus sur cette page
        chrome.runtime.sendMessage({
            action: 'pageVisibilityChanged',
            data: {
                visible: false,
                time: Date.now(),
                url: window.location.href
            }
        });
        
    } else {
        windowEventState.isVisible = true;
        console.log('👀 Page visible - L\'utilisateur est revenu sur cet onglet');
        
        // Notifier le background du retour de focus sur cette page
        chrome.runtime.sendMessage({
            action: 'pageVisibilityChanged',
            data: {
                visible: true,
                time: Date.now(),
                url: window.location.href
            }
        });
    }
});

// Surveiller le focus/blur de la fenêtre
window.addEventListener('blur', () => {
    console.log('🌫️ Fenêtre floue - Focus perdu');
    chrome.runtime.sendMessage({
        action: 'windowBlurred',
        data: {
            time: Date.now(),
            url: window.location.href
        }
    });
});

window.addEventListener('focus', () => {
    console.log('🎯 Fenêtre focalisée - Focus récupéré');
    chrome.runtime.sendMessage({
        action: 'windowFocused',
        data: {
            time: Date.now(),
            url: window.location.href
        }
    });
});

// Gérer les événements de sortie de fenêtre
function handleWindowExit(data) {
    console.log('🚪 Gestion de la sortie de fenêtre:', data);
    
    // Créer une notification visuelle sur la page
    createNotification('🚪 Extension en pause - Vous avez quitté la fenêtre', 'info');
    
    // Vous pouvez ajouter ici d'autres actions spécifiques
    // Par exemple: sauvegarder l'état actuel, pause des timers locaux, etc.
    
    // Marquer dans le stockage local de la page
    localStorage.setItem('autoClickTimer_windowExit', JSON.stringify({
        time: data.time,
        cycle: data.cycle,
        remainingTime: data.remainingTime
    }));
}

// Gérer les événements de retour sur fenêtre
function handleWindowReturn(data) {
    console.log('🏠 Gestion du retour sur fenêtre:', data);
    
    // Créer une notification visuelle sur la page
    createNotification('🏠 Extension reprise - Vous êtes de retour', 'success');
    
    // Nettoyer le marqueur de sortie
    localStorage.removeItem('autoClickTimer_windowExit');
    
    // Vous pouvez ajouter ici des actions de reprise
    // Par exemple: reprendre des timers locaux, rafraîchir des données, etc.
}

// Créer une notification visuelle sur la page
function createNotification(message, type = 'info') {
    // Vérifier si une notification existe déjà
    let existingNotif = document.getElementById('autoClickTimerNotification');
    if (existingNotif) {
        existingNotif.remove();
    }
    
    // Créer la notification
    const notification = document.createElement('div');
    notification.id = 'autoClickTimerNotification';
    notification.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animer l'apparition
    setTimeout(() => notification.style.opacity = '1', 10);
    
    // Supprimer après 3 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// Exécuter les clics finaux (appelé par le background)
function executeFinalClicks() {
    // Cette fonction sera appelée par le background quand le timer expire
    console.log('🔥 Exécution des clics finaux...');
    
    createNotification('⏰ Timer expiré - Exécution des actions...', 'info');
    
    // Ici vous pouvez ajouter la logique spécifique pour vos clics finaux
    // Cette fonction est appelée directement par le background script
}

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