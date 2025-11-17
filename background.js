// Service worker pour l'extension Auto Click Timer
console.log('🚀 Auto Click Timer Extension - Background script démarré');

// État global persistant de l'extension
let extensionState = {
    isRunning: false,
    remainingTime: 0,
    currentCycle: 0,
    intervalId: null,
    windowFocusLost: false,
    lastActiveTime: Date.now(),
    pauseOnWindowBlur: true
};

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
        currentCycle: 0,
        pauseOnWindowBlur: true,
        autoResumeOnFocus: true
    });
    
    if (details.reason === 'install') {
        console.log('🎉 Première installation de l\'extension');
    } else if (details.reason === 'update') {
        console.log('🔄 Extension mise à jour vers la version', chrome.runtime.getManifest().version);
    }
    
    // Démarrer immédiatement la surveillance
    initializeBackgroundMonitoring();
});

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

// Initialiser la surveillance en arrière-plan
function initializeBackgroundMonitoring() {
    // Démarrer le timer principal en arrière-plan (toujours actif)
    if (extensionState.intervalId) {
        clearInterval(extensionState.intervalId);
    }
    
    extensionState.intervalId = setInterval(() => {
        // Mettre à jour le timestamp d'activité
        extensionState.lastActiveTime = Date.now();
        
        // Sauvegarder périodiquement l'état
        chrome.storage.local.set({
            lastActiveTime: extensionState.lastActiveTime,
            extensionState: extensionState
        });
        
        // Traiter le timer seulement si actif
        if (extensionState.isRunning && extensionState.remainingTime > 0) {
            extensionState.remainingTime--;
            
            // Sauvegarder l'état mis à jour
            chrome.storage.local.set({
                remainingTime: extensionState.remainingTime,
                currentCycle: extensionState.currentCycle
            });
            
            console.log(`⏰ Timer background: ${formatBackgroundTime(extensionState.remainingTime)} - Cycle ${extensionState.currentCycle}`);
            
        } else if (extensionState.isRunning && extensionState.remainingTime <= 0) {
            // Timer expiré - déclencher les actions
            console.log('⏰ Timer expiré en arrière-plan !');
            handleTimerExpired();
        }
    }, 1000);
    
    console.log('🔧 Surveillance d\'arrière-plan initialisée et active en permanence');
}

// Formater le temps pour les logs
function formatBackgroundTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Timer en arrière-plan pour maintenir l'état même si le popup est fermé
function startBackgroundTimer() {
    extensionState.isRunning = true;
    
    // Sauvegarder l'état de démarrage
    chrome.storage.local.set({
        isRunning: true,
        startTime: Date.now()
    });
    
    console.log('⏰ Timer d\'arrière-plan activé');
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

// Gérer les événements de fenêtres et onglets
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // L'utilisateur a quitté toutes les fenêtres Chrome
        console.log('👋 Focus perdu - Utilisateur a quitté les fenêtres Chrome');
        handleWindowBlur();
    } else {
        // L'utilisateur est revenu sur une fenêtre Chrome
        console.log('👀 Focus récupéré - Utilisateur est revenu sur Chrome');
        handleWindowFocus(windowId);
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('📄 Onglet changé:', activeInfo.tabId);
    handleTabChange(activeInfo.tabId);
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

// Gérer la perte de focus de la fenêtre
function handleWindowBlur() {
    extensionState.windowFocusLost = true;
    
    chrome.storage.local.get(['pauseOnWindowBlur'], (result) => {
        if (result.pauseOnWindowBlur && extensionState.isRunning) {
            console.log('⏸️ Pause automatique - L\'utilisateur a quitté Chrome');
            
            // Sauvegarder l'état de pause
            chrome.storage.local.set({
                isPausedByWindowBlur: true,
                pauseTime: Date.now(),
                windowFocusLost: true
            });
            
            // Déclencher une procédure spécifique si nécessaire
            triggerWindowExitProcedure();
        }
    });
}

// Gérer le retour de focus de la fenêtre
function handleWindowFocus(windowId) {
    if (extensionState.windowFocusLost) {
        extensionState.windowFocusLost = false;
        
        chrome.storage.local.get(['autoResumeOnFocus', 'isPausedByWindowBlur'], (result) => {
            if (result.autoResumeOnFocus && result.isPausedByWindowBlur && extensionState.isRunning) {
                console.log('▶️ Reprise automatique - L\'utilisateur est revenu sur Chrome');
                
                // Reprendre le timer
                chrome.storage.local.set({
                    isPausedByWindowBlur: false,
                    resumeTime: Date.now(),
                    windowFocusLost: false
                });
                
                // Déclencher une procédure de retour si nécessaire
                triggerWindowReturnProcedure();
            }
        });
    }
}

// Gérer les changements d'onglets
function handleTabChange(tabId) {
    if (extensionState.isRunning) {
        // Enregistrer le changement d'onglet
        chrome.storage.local.set({
            lastActiveTab: tabId,
            lastTabChangeTime: Date.now()
        });
        
        console.log(`📄 Changement vers l'onglet ${tabId}`);
    }
}

// Déclencher une procédure quand l'utilisateur quitte la fenêtre
function triggerWindowExitProcedure() {
    console.log('🚪 Procédure de sortie déclenchée');
    
    // Enregistrer l'événement
    chrome.storage.local.set({
        lastExitEvent: {
            time: Date.now(),
            type: 'WINDOW_EXIT',
            cycleActive: extensionState.currentCycle,
            remainingTime: extensionState.remainingTime
        }
    });
    
    // Vous pouvez ajouter ici des actions spécifiques
    // Par exemple: sauvegarder des données, déclencher des clics, etc.
    
    // Notifier les content scripts de l'événement
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'windowExitDetected',
                data: {
                    time: Date.now(),
                    cycle: extensionState.currentCycle,
                    remainingTime: extensionState.remainingTime
                }
            }).catch(() => {
                // Ignorer les erreurs de communication
            });
        });
    });
}

// Déclencher une procédure quand l'utilisateur revient
function triggerWindowReturnProcedure() {
    console.log('🏠 Procédure de retour déclenchée');
    
    // Enregistrer l'événement
    chrome.storage.local.set({
        lastReturnEvent: {
            time: Date.now(),
            type: 'WINDOW_RETURN',
            cycleActive: extensionState.currentCycle,
            remainingTime: extensionState.remainingTime
        }
    });
    
    // Notifier les content scripts du retour
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'windowReturnDetected',
                data: {
                    time: Date.now(),
                    cycle: extensionState.currentCycle,
                    remainingTime: extensionState.remainingTime
                }
            }).catch(() => {
                // Ignorer les erreurs de communication
            });
        });
    });
}

// Restaurer l'état au démarrage du service worker
chrome.storage.local.get([
    'isRunning', 
    'remainingTime', 
    'currentCycle', 
    'extensionState',
    'pauseOnWindowBlur',
    'autoResumeOnFocus',
    'isPausedByWindowBlur'
], (result) => {
    // Restaurer l'état complet
    if (result.extensionState) {
        extensionState = { ...extensionState, ...result.extensionState };
    }
    
    if (result.isRunning) {
        extensionState.isRunning = result.isRunning;
        extensionState.remainingTime = result.remainingTime || 0;
        extensionState.currentCycle = result.currentCycle || 0;
        extensionState.windowFocusLost = result.isPausedByWindowBlur || false;
        
        console.log('🔄 État restauré:', {
            cycle: extensionState.currentCycle,
            time: formatBackgroundTime(extensionState.remainingTime),
            paused: extensionState.windowFocusLost
        });
        
        // Toujours démarrer la surveillance, même si en pause
        if (!extensionState.intervalId) {
            initializeBackgroundMonitoring();
        }
    } else {
        // Même si pas actif, démarrer la surveillance pour être prêt
        initializeBackgroundMonitoring();
    }
});

// Gérer la suspension du service worker
chrome.runtime.onSuspend.addListener(() => {
    console.log('💤 Service worker suspendu - Sauvegarde de l\'état');
    
    // Sauvegarder l'état complet avant suspension
    chrome.storage.local.set({
        extensionState: extensionState,
        isRunning: extensionState.isRunning,
        remainingTime: extensionState.remainingTime,
        currentCycle: extensionState.currentCycle,
        lastSuspendTime: Date.now()
    });
    
    // Nettoyer le timer
    if (extensionState.intervalId) {
        clearInterval(extensionState.intervalId);
    }
});

// Gérer le réveil du service worker
chrome.runtime.onStartup.addListener(() => {
    console.log('🌅 Service worker démarré au boot du système');
    initializeBackgroundMonitoring();
});

// Surveiller l'inactivité et maintenir le service worker actif
setInterval(() => {
    // Ping pour maintenir le service worker actif
    chrome.storage.local.set({ 
        lastHeartbeat: Date.now(),
        extensionActive: true
    });
}, 25000); // Toutes les 25 secondes

console.log('✅ Background script initialisé avec surveillance permanente');