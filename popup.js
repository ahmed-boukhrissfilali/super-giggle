// Variables globales
let isRunning = false;
let timerInterval;
let remainingTime = 0;
let currentCycle = 0;
let searchButtonInterval;
let isSearchingButton = false;
let taskData = [];
let lastDetectedTaskTime = null;

// Éléments DOM
const timerDisplay = document.getElementById('timerDisplay');
const status = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const buttonSelector = document.getElementById('buttonSelector');
const finalSelector = document.getElementById('finalSelector');
const minTime = document.getElementById('minTime');
const maxTime = document.getElementById('maxTime');
const testBtn = document.getElementById('testBtn');
const testFinalBtn = document.getElementById('testFinalBtn');
const pauseOnWindowBlur = document.getElementById('pauseOnWindowBlur');
const autoResumeOnFocus = document.getElementById('autoResumeOnFocus');

// Charger les paramètres sauvegardés
chrome.storage.local.get([
    'buttonSelector', 
    'finalSelector', 
    'minTime', 
    'maxTime', 
    'pauseOnWindowBlur', 
    'autoResumeOnFocus'
], (result) => {
    if (result.buttonSelector) buttonSelector.value = result.buttonSelector;
    if (result.finalSelector) finalSelector.value = result.finalSelector;
    if (result.minTime) minTime.value = result.minTime;
    if (result.maxTime) maxTime.value = result.maxTime;
    
    // Charger les nouvelles options (par défaut à true)
    pauseOnWindowBlur.checked = result.pauseOnWindowBlur !== false;
    autoResumeOnFocus.checked = result.autoResumeOnFocus !== false;
});

// Sauvegarder les paramètres à chaque modification
[buttonSelector, finalSelector, minTime, maxTime, pauseOnWindowBlur, autoResumeOnFocus].forEach(input => {
    input.addEventListener('change', saveSettings);
});

function saveSettings() {
    chrome.storage.local.set({
        buttonSelector: buttonSelector.value,
        finalSelector: finalSelector.value,
        minTime: parseInt(minTime.value),
        maxTime: parseInt(maxTime.value),
        pauseOnWindowBlur: pauseOnWindowBlur.checked,
        autoResumeOnFocus: autoResumeOnFocus.checked
    });
    
    console.log('⚙️ Paramètres sauvegardés:', {
        pauseOnWindowBlur: pauseOnWindowBlur.checked,
        autoResumeOnFocus: autoResumeOnFocus.checked
    });
}

// Formater le temps pour l'affichage
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Mettre à jour l'affichage du timer
function updateDisplay() {
    if (isRunning && remainingTime > 0) {
        // Décrémenter le timer
        remainingTime--;
        
        // Sauvegarder l'état mis à jour
        chrome.storage.local.set({
            remainingTime: remainingTime,
            isRunning: isRunning,
            currentCycle: currentCycle
        });
        
        console.log(`⏰ Timer: ${formatTime(remainingTime)} - Cycle ${currentCycle}`);
        
    } else if (isRunning && remainingTime <= 0) {
        // Timer expiré, déclencher les actions finales
        console.log('⏰ Timer expiré ! Déclenchement des actions finales...');
        execute2FinalClicks();
        return;
    }
    
    // Mettre à jour l'affichage
    timerDisplay.textContent = formatTime(remainingTime);
    
    // Vérifier si en pause à cause de la perte de focus
    chrome.storage.local.get(['isPausedByWindowBlur'], (result) => {
        // Mettre à jour le statut de l'interface
        if (isRunning) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            
            if (result.isPausedByWindowBlur) {
                status.textContent = `⏸️ En pause (Focus perdu) - Cycle ${currentCycle}`;
                status.className = 'status';
                status.style.backgroundColor = '#fff3cd';
                status.style.color = '#856404';
                status.style.border = '1px solid #ffeaa7';
            } else {
                status.textContent = `✅ Actif - Cycle ${currentCycle} - ${formatTime(remainingTime)}`;
                status.className = 'status active';
                status.style.backgroundColor = '#d4edda';
                status.style.color = '#155724';
                status.style.border = '1px solid #c3e6cb';
            }
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            status.textContent = '❌ Inactif';
            status.className = 'status inactive';
            status.style.backgroundColor = '#fff3cd';
            status.style.color = '#856404';
            status.style.border = '1px solid #ffeaa7';
        }
    });
}

// Synchroniser avec l'état en arrière-plan (utilisé au chargement)
function syncWithBackground() {
    chrome.storage.local.get(['isRunning', 'remainingTime', 'currentCycle'], (result) => {
        if (result.isRunning !== undefined) {
            isRunning = result.isRunning;
            remainingTime = result.remainingTime || 0;
            currentCycle = result.currentCycle || 0;
            
            console.log(`🔄 Synchronisation: Cycle ${currentCycle}, Temps: ${formatTime(remainingTime)}, Actif: ${isRunning}`);
            updateDisplay();
        }
    });
}

// Démarrer un nouveau cycle
async function startNewCycle() {
    currentCycle++;
    const min = parseInt(minTime.value);
    const max = parseInt(maxTime.value);
    const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    remainingTime = randomMinutes * 60; // Convertir en secondes
    
    // Sauvegarder l'état dans le storage
    chrome.storage.local.set({
        isRunning: true,
        remainingTime: remainingTime,
        currentCycle: currentCycle
    });
    
    console.log(`🔄 Cycle ${currentCycle} démarré : ${randomMinutes} minutes`);
    
    // Enregistrer le démarrage du cycle
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        await recordTaskData(tab.id, 'CYCLE_DEMARRE');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement du cycle:', error);
    }
    
    // Démarrer la recherche du premier bouton
    startSearchButton();
}

// Exécuter le clic initial
async function executeInitialClick() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const result = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: clickElement,
            args: [buttonSelector.value]
        });
        
        if (result[0].result) {
            console.log('✅ Clic initial exécuté avec succès');
            stopSearchButton(); // Arrêter la recherche car bouton trouvé
        } else {
            console.log('❌ Échec du clic initial - élément non trouvé');
            startSearchButton(); // Démarrer la recherche automatique
        }
    } catch (error) {
        console.error('❌ Erreur lors du clic initial:', error);
        startSearchButton(); // Démarrer la recherche en cas d'erreur
    }
}

// Exécuter les 2 clics finaux après expiration du timer
async function execute2FinalClicks() {
    console.log('⏰ Timer expiré ! Exécution des 2 clics finaux...');
    
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Premier clic final
        console.log('🖱️ Premier clic final...');
        await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: clickElement,
            args: [finalSelector.value]
        });
        
        // Attendre 1 seconde puis deuxième clic
        setTimeout(async () => {
            try {
                console.log('🖱️ Deuxième clic final...');
                await chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: clickElement,
                    args: [finalSelector.value]
                });
                
                console.log('✅ 2 clics finaux terminés');
                
                // Rafraîchir la page après les 2 clics
                console.log('🔄 Rafraîchissement de la page...');
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: () => {
                        window.location.reload();
                    }
                });
                
                // Attendre 4 secondes puis vérifier s'il y a déjà une tâche active
                setTimeout(() => {
                    if (isRunning) {
                        console.log('⏳ Attente terminée, vérification de l\'état...');
                        checkTaskStateAfterRefresh();
                    }
                }, 4000);
                
            } catch (error) {
                console.error('❌ Erreur lors du 2e clic final:', error);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erreur lors des clics finaux:', error);
    }
}

// Fonction injectée pour cliquer sur un élément
function clickElement(selector) {
    let element;
    
    // Essayer d'abord comme XPath
    if (selector.startsWith('//') || selector.startsWith('/')) {
        try {
            element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        } catch (e) {
            console.log('XPath failed, trying CSS selector');
        }
    }
    
    // Si XPath échoue, essayer comme CSS selector
    if (!element) {
        try {
            element = document.querySelector(selector);
        } catch (e) {
            console.error('CSS selector failed:', e);
        }
    }
    
    if (element) {
        // Faire défiler jusqu'à l'élément
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Attendre un peu puis cliquer
        setTimeout(() => {
            // Simuler un clic naturel complet
            element.focus();
            
            // Événements de souris
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(event);
            });
            
            // Clic direct pour compatibilité
            element.click();
            
        }, 300);
        
        console.log('✅ Élément trouvé et cliqué:', selector);
        return true;
    } else {
        console.error('❌ Élément non trouvé:', selector);
        return false;
    }
}

// Fonction de test pour le bouton initial
async function testClick() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const result = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: clickElement,
            args: [buttonSelector.value]
        });
        
        if (result[0].result) {
            alert('✅ Test du clic initial réussi !\nÉlément trouvé et cliqué.');
        } else {
            alert('❌ Test du clic initial échoué !\nÉlément non trouvé. Vérifiez le sélecteur.');
        }
    } catch (error) {
        console.error('Erreur lors du test initial:', error);
        alert(`❌ Erreur lors du test initial :\n${error.message}`);
    }
}

// Fonction de test pour les clics finaux
async function testFinalClick() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const result = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: clickElement,
            args: [finalSelector.value]
        });
        
        if (result[0].result) {
            alert('✅ Test des clics finaux réussi !\nÉlément trouvé et cliqué.');
        } else {
            alert('❌ Test des clics finaux échoué !\nÉlément non trouvé. Vérifiez le sélecteur.');
        }
    } catch (error) {
        console.error('Erreur lors du test final:', error);
        alert(`❌ Erreur lors du test final :\n${error.message}`);
    }
}

// Événements des boutons
startBtn.addEventListener('click', () => {
    isRunning = true;
    currentCycle = 0;
    remainingTime = 0;
    
    // Sauvegarder les paramètres
    saveSettings();
    
    // Informer le background script de démarrer
    chrome.runtime.sendMessage({ action: 'startTimer' });
    
    console.log('🚀 Démarrage de l\'extension...');
    
    // Démarrer le premier cycle
    startNewCycle();
    
    // Démarrer le timer d'affichage
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    timerInterval = setInterval(updateDisplay, 1000);
    
    // Mise à jour immédiate de l'interface
    updateDisplay();
});

stopBtn.addEventListener('click', () => {
    // Informer le background script d'arrêter
    chrome.runtime.sendMessage({ action: 'stopTimer' });
    
    isRunning = false;
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    status.textContent = '❌ Inactif';
    status.className = 'status inactive';
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Arrêter la recherche du bouton
    stopSearchButton();
    
    // Arrêter la surveillance de tâche si elle est active
    stopTaskMonitoring();
    
    // Nettoyer l'état de surveillance
    chrome.storage.local.set({
        waitingForTaskCompletion: false
    });
    
    remainingTime = 0;
    currentCycle = 0;
    timerDisplay.textContent = '00:00:00';
    
    console.log('🛑 Extension arrêtée');
});

testBtn.addEventListener('click', testClick);
testFinalBtn.addEventListener('click', testFinalClick);

// Boutons pour l'historique
document.getElementById('viewHistoryBtn').addEventListener('click', showTaskHistory);
document.getElementById('downloadLogBtn').addEventListener('click', downloadCurrentLog);
document.getElementById('downloadTextBtn').addEventListener('click', downloadTextOnly);

// Télécharger uniquement en format texte
async function downloadTextOnly() {
    try {
        if (taskData.length === 0) {
            alert('📄 Aucune donnée à exporter. Démarrez l\'extension pour générer des données.');
            return;
        }
        
        const now = new Date();
        const filename = `AutoClickTimer_${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.toLocaleTimeString('fr-FR').replace(/:/g, '-')}.txt`;
        
        const textContent = generateTextLogFile();
        const success = await downloadTextFile(textContent, filename);
        
        if (success) {
            alert(`📄 Fichier texte téléchargé!\n${taskData.length} enregistrements exportés.`);
        } else {
            alert('❌ Erreur lors du téléchargement du fichier texte.');
        }
        
    } catch (error) {
        console.error('❌ Erreur téléchargement texte:', error);
        alert('❌ Erreur lors du téléchargement.');
    }
}

// Afficher l'historique des tâches
function showTaskHistory() {
    chrome.storage.local.get(['taskHistory'], (result) => {
        const history = result.taskHistory || [];
        if (history.length === 0) {
            alert('📝 Aucun historique de tâches disponible.');
            return;
        }
        
        let message = `📊 HISTORIQUE DES TACHES (${history.length} détections):\n\n`;
        history.slice(-5).forEach((record, index) => {
            message += `${index + 1}. ${record.date} ${record.time}\n`;
            message += `   Type: ${record.eventType}\n`;
            message += `   Timer: ${record.timerDetected}\n\n`;
        });
        
        if (history.length > 5) {
            message += `... et ${history.length - 5} autres détections.\n`;
        }
        
        alert(message);
    });
}

// Télécharger le log actuel
async function downloadCurrentLog() {
    try {
        if (taskData.length === 0) {
            alert('📊 Aucune donnée à exporter. Démarrez l\'extension pour générer des données.');
            return;
        }
        
        const now = new Date();
        const baseFilename = `AutoClickTimer_${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.toLocaleTimeString('fr-FR').replace(/:/g, '-')}`;
        
        // Essayer Excel d'abord
        console.log('📊 Tentative de téléchargement Excel...');
        const excelContent = generateExcelFile();
        const excelSuccess = await downloadExcelFile(excelContent, `${baseFilename}.csv`);
        
        if (excelSuccess) {
            alert(`📊 Fichier Excel téléchargé avec succès!\n${taskData.length} enregistrements exportés.`);
        } else {
            // Si Excel échoue, essayer le fichier texte
            console.log('📄 Excel échoué, tentative fichier texte...');
            const textContent = generateTextLogFile();
            const textSuccess = await downloadTextFile(textContent, `${baseFilename}.txt`);
            
            if (textSuccess) {
                alert(`📄 Fichier texte téléchargé!\n${taskData.length} enregistrements exportés.\n(Excel non disponible, fichier texte utilisé)`);
            } else {
                alert('❌ Erreur lors du téléchargement.\nVérifiez les permissions de l\'extension.');
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur téléchargement:', error);
        alert('❌ Erreur lors du téléchargement du fichier.');
    }
}

// Fonctions pour la recherche automatique du premier bouton
function startSearchButton() {
    if (isSearchingButton) return; // Déjà en cours de recherche
    
    isSearchingButton = true;
    console.log('🔍 Démarrage de la recherche du premier bouton...');
    
    // Vérifier immédiatement
    checkAndClickButton();
    
    // Puis vérifier toutes les 3 secondes
    searchButtonInterval = setInterval(() => {
        checkAndClickButton();
    }, 3000);
}

function stopSearchButton() {
    if (searchButtonInterval) {
        clearInterval(searchButtonInterval);
        searchButtonInterval = null;
    }
    isSearchingButton = false;
    console.log('✅ Recherche du bouton arrêtée - bouton trouvé');
}

// Enregistrer les données de tâche dans un fichier
async function recordTaskData(tabId, eventType) {
    try {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const timeStr = now.toLocaleTimeString('fr-FR');
        
        // Récupérer le temps du timer visible sur la page
        const timerInfo = await chrome.scripting.executeScript({
            target: {tabId: tabId},
            func: () => {
                // Chercher différents formats de timer
                const timerSelectors = [
                    'div[class*="timer"]',
                    'div[class*="countdown"]',
                    'span[class*="time"]',
                    '.timer',
                    '[data-timer]',
                    'div:contains(":")',
                    // Ajouter d'autres sélecteurs selon votre site
                ];
                
                for (let selector of timerSelectors) {
                    try {
                        let elements = document.querySelectorAll(selector);
                        for (let element of elements) {
                            let text = element.textContent || element.innerText;
                            // Chercher un format de temps (HH:MM:SS ou MM:SS)
                            let timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/g);
                            if (timeMatch && timeMatch.length > 0) {
                                return {
                                    timerText: timeMatch[0],
                                    elementText: text.trim(),
                                    selector: selector
                                };
                            }
                        }
                    } catch (e) {}
                }
                
                // Si aucun timer trouvé, retourner info générale
                return {
                    timerText: 'Timer non détecté',
                    elementText: 'Tâche active sans timer visible',
                    selector: 'N/A'
                };
            }
        });
        
        const taskRecord = {
            date: dateStr,
            time: timeStr,
            timestamp: now.toISOString(),
            eventType: eventType,
            timerDetected: timerInfo[0].result.timerText,
            elementText: timerInfo[0].result.elementText,
            selector: timerInfo[0].result.selector,
            cycleNumber: currentCycle,
            extensionTimer: formatTime(remainingTime)
        };
        
        // Ajouter à l'historique
        taskData.push(taskRecord);
        
        // Sauvegarder dans le stockage Chrome
        chrome.storage.local.set({
            taskHistory: taskData,
            lastTaskDetection: taskRecord
        });
        
        // Ne pas déclencher de téléchargement automatique ici.
        // Les données sont sauvegardées dans `taskData` et `chrome.storage.local`.
        // Le téléchargement est effectué manuellement via l'UI (boutons "Excel" / "Texte").
        
        console.log('📝 Données de tâche enregistrées:', taskRecord);
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement:', error);
    }
}

// Générer le fichier Excel
function generateExcelFile() {
    // Créer les données pour Excel
    const worksheetData = [];
    
    // En-têtes
    worksheetData.push([
        'N°',
        'Date', 
        'Heure',
        'Type d\'événement',
        'Timer détecté',
        'Texte élément',
        'Sélecteur',
        'Cycle extension',
        'Timer extension',
        'Timestamp'
    ]);
    
    // Données
    taskData.forEach((record, index) => {
        worksheetData.push([
            index + 1,
            record.date,
            record.time,
            record.eventType,
            record.timerDetected,
            record.elementText,
            record.selector,
            record.cycleNumber,
            record.extensionTimer,
            record.timestamp
        ]);
    });
    
    return generateCSVFromData(worksheetData);
}

// Génerer un CSV (compatible Excel)
function generateCSVFromData(data) {
    let csvContent = '';
    
    data.forEach(row => {
        // Échapper les guillemets et virgules
        const escapedRow = row.map(cell => {
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        });
        
        csvContent += escapedRow.join(',') + '\n';
    });
    
    return csvContent;
}

// Générer le contenu du fichier texte
function generateTextLogFile() {
    let content = '=== AUTO CLICK TIMER - LOG DES TACHES ===\n\n';
    content += `Généré le: ${new Date().toLocaleString('fr-FR')}\n`;
    content += `Total des détections: ${taskData.length}\n\n`;
    
    taskData.forEach((record, index) => {
        content += `--- DETECTION ${index + 1} ---\n`;
        content += `Date: ${record.date}\n`;
        content += `Heure: ${record.time}\n`;
        content += `Type: ${record.eventType}\n`;
        content += `Timer détecté: ${record.timerDetected}\n`;
        content += `Texte de l'élément: ${record.elementText}\n`;
        content += `Sélecteur: ${record.selector}\n`;
        content += `Cycle extension: ${record.cycleNumber}\n`;
        content += `Timer extension: ${record.extensionTimer}\n`;
        content += `Timestamp: ${record.timestamp}\n\n`;
    });
    
    return content;
}

// Télécharger le fichier Excel
async function downloadExcelFile(content, filename) {
    try {
        console.log('📊 Tentative de téléchargement Excel...');
        
        // Créer un blob avec BOM pour Excel
        const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
        const blob = new Blob([BOM + content], { 
            type: 'text/csv;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        
        // Utiliser l'API de téléchargement de Chrome
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false
        });
        
        console.log(`✅ Fichier Excel téléchargé: ${filename} (ID: ${downloadId})`);
        
        // Nettoyer l'URL
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erreur téléchargement Excel:', error);
        return false;
    }
}

// Télécharger le fichier texte
async function downloadTextFile(content, filename) {
    try {
        console.log('📄 Tentative de téléchargement texte...');
        
        const blob = new Blob([content], { 
            type: 'text/plain;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false
        });
        
        console.log(`✅ Fichier texte téléchargé: ${filename} (ID: ${downloadId})`);
        
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erreur téléchargement texte:', error);
        return false;
    }
}

// Télécharger le fichier de log (fonction de compatibilité)
async function downloadTaskFile(content, filename) {
    return downloadExcelFile(content, filename);
}

// Vérifier l'état après refresh et décider quoi faire
async function checkTaskStateAfterRefresh() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Vérifier s'il y a déjà un timer actif visible sur la page
        const hasActiveTask = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: () => {
                // Chercher des indicateurs d'une tâche active
                // (vous pouvez adapter ces sélecteurs selon votre site)
                const indicators = [
                    'div[class*="timer"]',
                    'div[class*="active"]', 
                    'div[class*="running"]',
                    '[data-timer]',
                    '.countdown'
                ];
                
                for (let selector of indicators) {
                    try {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.match(/\d+:\d+/)) {
                            return {
                                hasTask: true,
                                timerText: element.textContent.match(/\d+:\d+/)[0]
                            };
                        }
                    } catch (e) {}
                }
                return { hasTask: false }; // Pas de timer actif trouvé
            }
        });
        
        if (hasActiveTask[0].result.hasTask) {
            console.log('🕒 Tâche déjà active détectée, réinitialisation et arrêt du timer extension...');
            
            // Réinitialiser et arrêter le timer de l'extension
            remainingTime = 0;
            
            // Sauvegarder l'état d'arrêt temporaire
            chrome.storage.local.set({
                remainingTime: 0,
                waitingForTaskCompletion: true,
                detectedTaskTimer: hasActiveTask[0].result.timerText
            });
            
            // Enregistrer les données de la tâche détectée
            await recordTaskData(tab.id, 'TACHE_DETECTEE_TIMER_REINITIALISE');
            
            // Démarrer la surveillance de la tâche détectée
            startTaskMonitoring();
            
        } else {
            console.log('🔍 Aucune tâche active détectée, démarrage d\'un nouveau cycle...');
            startNewCycle(); // Démarrer un nouveau cycle normalement
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de la vérification de l\'état:', error);
        // En cas d'erreur, démarrer un nouveau cycle par sécurité
        startNewCycle();
    }
}

async function checkAndClickButton() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Vérifier si le bouton existe
        const checkResult = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: (selector) => {
                let element;
                // Vérifier XPath
                if (selector.startsWith('//') || selector.startsWith('/')) {
                    try {
                        element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    } catch (e) {}
                }
                // Vérifier CSS
                if (!element) {
                    try {
                        element = document.querySelector(selector);
                    } catch (e) {}
                }
                return !!element;
            },
            args: [buttonSelector.value]
        });
        
        if (checkResult[0].result) {
            // Bouton trouvé, essayer de cliquer
            console.log('✅ Premier bouton trouvé, tentative de clic...');
            executeInitialClick();
        } else {
            // Bouton non trouvé, reloader la page
            console.log('🔄 Premier bouton non trouvé, rechargement de la page...');
            await chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func: () => {
                    window.location.reload();
                }
            });
        }
    } catch (error) {
        console.error('❌ Erreur lors de la recherche du bouton:', error);
    }
}

// Nouvelle fonction : surveiller la tâche détectée jusqu'à sa fin
let taskMonitoringInterval;

function startTaskMonitoring() {
    console.log('🔍 Démarrage de la surveillance de la tâche détectée...');
    
    if (taskMonitoringInterval) {
        clearInterval(taskMonitoringInterval);
    }
    
    // Vérifier toutes les 5 secondes si la tâche est toujours active
    taskMonitoringInterval = setInterval(async () => {
        await checkIfTaskStillActive();
    }, 5000);
    
    // Vérifier immédiatement
    checkIfTaskStillActive();
}

function stopTaskMonitoring() {
    if (taskMonitoringInterval) {
        clearInterval(taskMonitoringInterval);
        taskMonitoringInterval = null;
    }
    console.log('✅ Surveillance de tâche arrêtée');
}

async function checkIfTaskStillActive() {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        // Vérifier si la tâche est toujours active
        const taskStatus = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: () => {
                const indicators = [
                    'div[class*="timer"]',
                    'div[class*="active"]', 
                    'div[class*="running"]',
                    '[data-timer]',
                    '.countdown'
                ];
                
                for (let selector of indicators) {
                    try {
                        const element = document.querySelector(selector);
                        if (element && element.textContent.match(/\d+:\d+/)) {
                            return {
                                isActive: true,
                                timerText: element.textContent.match(/\d+:\d+/)[0]
                            };
                        }
                    } catch (e) {}
                }
                return { isActive: false };
            }
        });
        
        if (!taskStatus[0].result.isActive) {
            console.log('✅ Tâche détectée terminée ! Déclenchement des 2 clics finaux...');
            
            // Arrêter la surveillance
            stopTaskMonitoring();
            
            // Enregistrer la fin de tâche
            await recordTaskData(tab.id, 'TACHE_TERMINEE');
            
            // Sauvegarder que la surveillance est terminée
            chrome.storage.local.set({
                waitingForTaskCompletion: false
            });
            
            // Exécuter les 2 clics finaux maintenant
            execute2FinalClicks();
            
        } else {
            console.log(`🕒 Tâche toujours active: ${taskStatus[0].result.timerText}`);
            // Mettre à jour l'affichage pour montrer qu'on attend
            timerDisplay.textContent = `Attente: ${taskStatus[0].result.timerText}`;
            status.textContent = `⏳ En attente de fin de tâche - ${taskStatus[0].result.timerText}`;
        }
        
    } catch (error) {
        console.error('❌ Erreur surveillance tâche:', error);
    }
}

// Restaurer l'état au chargement
chrome.storage.local.get(['isRunning', 'remainingTime', 'currentCycle', 'taskHistory', 'waitingForTaskCompletion'], (result) => {
    // Charger l'historique des tâches
    taskData = result.taskHistory || [];
    console.log(`📊 Historique chargé: ${taskData.length} enregistrements`);
    
    if (result.isRunning) {
        // Synchroniser l'état
        syncWithBackground();
        
        // Si on était en train d'attendre la fin d'une tâche, reprendre la surveillance
        if (result.waitingForTaskCompletion) {
            console.log('🔄 Reprise de la surveillance de tâche après redémarrage...');
            startTaskMonitoring();
        }
        
        // Démarrer le timer d'affichage
        timerInterval = setInterval(updateDisplay, 1000);
        
        console.log(`🔄 État restauré - Extension redémarrée`);
    } else {
        // Juste mettre à jour l'affichage initial
        updateDisplay();
    }
});

console.log('🚀 Auto Click Timer Extension chargée');