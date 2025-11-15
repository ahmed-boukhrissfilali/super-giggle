// Service worker pour l'extension Auto Click Timer
console.log('🚀 Auto Click Timer Extension - Background script démarré');

// Gérer l'installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('✅ Extension installée/mise à jour');
    
    // Initialiser les paramètres par défaut
    chrome.storage.local.set({
        buttonSelector: '//*[@id="wrapper"]/div[2]/div/div/div/div[2]/div/div/div/div[2]/div/div[3]/button',
        finalSelector: '//*[@id="wrapper"]/div[1]/div[2]/div/main/div/div[2]/nav/ul[4]/li/div/button[2]',
        minTime: 20,
        maxTime: 25,
        isRunning: false,
        remainingTime: 0,
        currentCycle: 0
    });
    
    if (details.reason === 'install') {
        console.log('🎉 Première installation de l\'extension');
    } else if (details.reason === 'update') {
        console.log('🔄 Extension mise à jour vers la version', chrome.runtime.getManifest().version);
    }
});

// État global de l'extension
let extensionState = {
    isRunning: false,
    remainingTime: 0,
    currentCycle: 0,
    intervalId: null
};

// Gérer les messages entre les différentes parties de l'extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getStatus':
            chrome.storage.local.get(['isRunning', 'remainingTime', 'currentCycle'], (result) => {
                sendResponse(result);
            });
            return true; // Permet la réponse asynchrone
            
        case 'updateStatus':
            extensionState = { ...extensionState, ...request.data };
            chrome.storage.local.set(extensionState);
            break;
            
        case 'startTimer':
            startBackgroundTimer();
            break;
            
        case 'stopTimer':
            stopBackgroundTimer();
            break;
            
        default:
            console.log('Message non reconnu:', request);
    }
});

// Timer en arrière-plan pour maintenir l'état même si le popup est fermé
function startBackgroundTimer() {
    if (extensionState.intervalId) {
        clearInterval(extensionState.intervalId);
    }
    
    extensionState.intervalId = setInterval(() => {
        if (extensionState.isRunning && extensionState.remainingTime > 0) {
            extensionState.remainingTime--;
            chrome.storage.local.set({
                remainingTime: extensionState.remainingTime
            });
        } else if (extensionState.isRunning && extensionState.remainingTime <= 0) {
            // Timer expiré - déclencher les actions
            handleTimerExpired();
        }
    }, 1000);
    
    console.log('⏰ Timer d\'arrière-plan démarré');
}

function stopBackgroundTimer() {
    if (extensionState.intervalId) {
        clearInterval(extensionState.intervalId);
        extensionState.intervalId = null;
    }
    
    extensionState.isRunning = false;
    extensionState.remainingTime = 0;
    extensionState.currentCycle = 0;
    
    chrome.storage.local.set(extensionState);
    console.log('🛑 Timer d\'arrière-plan arrêté');
}

// Gérer l'expiration du timer
async function handleTimerExpired() {
    console.log('⏰ Timer expiré dans le background');
    
    try {
        // Obtenir l'onglet actif
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (tab) {
            // Envoyer un message au content script pour effectuer les clics
            chrome.tabs.sendMessage(tab.id, {
                action: 'executeFinalClicks'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Erreur communication avec content script:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Message envoyé au content script');
                }
            });
        }
    } catch (error) {
        console.error('❌ Erreur lors de la gestion du timer expiré:', error);
    }
}

// Gérer les événements d'onglets
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('📄 Onglet changé:', activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('📄 Page chargée:', tab.url);
        
        // Réinjecter le content script si nécessaire
        if (extensionState.isRunning) {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
                files: ['content.js']
            }).catch(error => {
                // Ignorer les erreurs pour les pages système
                if (!error.message.includes('chrome://') && !error.message.includes('chrome-extension://')) {
                    console.log('⚠️ Impossible d\'injecter le script:', error);
                }
            });
        }
    }
});

// Restaurer l'état au démarrage
chrome.storage.local.get(['isRunning', 'remainingTime', 'currentCycle'], (result) => {
    if (result.isRunning) {
        extensionState = {
            isRunning: result.isRunning,
            remainingTime: result.remainingTime || 0,
            currentCycle: result.currentCycle || 0
        };
        
        // Redémarrer le timer si nécessaire
        if (extensionState.remainingTime > 0) {
            startBackgroundTimer();
            console.log('🔄 État restauré et timer redémarré');
        }
    }
});

// Gérer la fermeture de l'extension
chrome.runtime.onSuspend.addListener(() => {
    console.log('💤 Extension suspendue');
    chrome.storage.local.set(extensionState);
});

console.log('✅ Background script initialisé');