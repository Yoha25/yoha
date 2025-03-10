// מערך לאחסון נתוני חובות
let debts = [];

// פונקציה להוספת חוב חדש
function addDebt() {
    const person = document.getElementById('debt-person').value.trim();
    const type = document.getElementById('debt-type').value;
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const date = document.getElementById('debt-date').value;
    const description = document.getElementById('debt-description').value.trim();
    
    if (!person || isNaN(amount) || amount <= 0 || !date || !description) {
        alert('נא למלא את כל השדות בצורה תקינה');
        return;
    }

// פונקציה להוספת מאזינים (event listeners) לאלמנטים בממשק הדיאלוג של חובות
function setupDebtEventListeners() {
    // מאזין לכפתור הוספת חוב
    const addDebtButton = document.getElementById('add-debt');
    if (addDebtButton) {
        addDebtButton.addEventListener('click', addDebt);
    }
    
    // מאזין לכפתור עדכון חוב
    const updateDebtButton = document.getElementById('update-debt-btn');
    if (updateDebtButton) {
        updateDebtButton.addEventListener('click', updateDebt);
    }
    
    // מאזין לשינוי באדם שנבחר לעדכון
    const updateDebtPersonSelect = document.getElementById('update-debt-person');
    if (updateDebtPersonSelect) {
        updateDebtPersonSelect.addEventListener('change', showSelectedDebtInfo);
    }
    
    // מאזין לשינוי בסוג העדכון
    const updateDebtTypeSelect = document.getElementById('update-debt-type');
    if (updateDebtTypeSelect) {
        updateDebtTypeSelect.addEventListener('change', toggleAmountField);
    }
    
    // מאזין לפילטר סוג החוב
    const debtFilterSelect = document.getElementById('debt-filter');
    if (debtFilterSelect) {
        debtFilterSelect.addEventListener('change', renderDebts);
    }
    
    // מאזין לבחירת אדם להצגת היסטוריה
    const debtHistoryPersonSelect = document.getElementById('debt-history-person');
    if (debtHistoryPersonSelect) {
        debtHistoryPersonSelect.addEventListener('change', function() {
            const debtId = this.value;
            if (debtId) {
                renderDebtHistoryForPerson(debtId);
            } else {
                document.getElementById('debt-history-container').style.display = 'none';
            }
        });
    }
    
    // הגדרת תאריך ברירת מחדל להיום
    const today = new Date().toISOString().split('T')[0];
    const debtDateInput = document.getElementById('debt-date');
    const updateDebtDateInput = document.getElementById('update-debt-date');
    
    if (debtDateInput) debtDateInput.value = today;
    if (updateDebtDateInput) updateDebtDateInput.value = today;
}
    
    // בדיקה אם כבר קיים חוב לאדם זה
    const existingDebtIndex = debts.findIndex(debt => 
        debt.person.toLowerCase() === person.toLowerCase() && debt.active);
    
    if (existingDebtIndex !== -1) {
        if (!confirm(`כבר קיים חוב פעיל עבור ${person}. האם ברצונך להוסיף חוב חדש?`)) {
            return;
        }
    }
    
    // יצירת מזהה ייחודי לחוב
    const debtId = Date.now();
    
    // יצירת רשומת חוב חדשה
    const newDebt = {
        id: debtId,
        person: person,
        type: type,
        initialAmount: amount,
        currentAmount: amount,
        startDate: date,
        lastUpdateDate: date,
        active: true,
        history: [
            {
                id: Date.now(),
                date: date,
                description: description,
                amount: amount,
                type: 'create',
                runningTotal: amount
            }
        ]
    };
    
    debts.push(newDebt);
    saveData();
    
    // איפוס השדות
    document.getElementById('debt-person').value = '';
    document.getElementById('debt-amount').value = '';
    document.getElementById('debt-description').value = '';
    
    // עדכון התצוגה
    renderDebts();
    updateDebtPersonDropdowns();
    
    // שליחת אירוע לאנליטיקס של Firebase
    try {
        if (typeof analytics !== 'undefined') {
            analytics.logEvent('debt_added', {
                debt_type: type,
                amount: amount
            });
        }
    } catch (error) {
        console.error('Analytics error:', error);
    }
}

// פונקציה לעדכון חוב קיים
function updateDebt() {
    const personId = document.getElementById('update-debt-person').value;
    if (!personId) {
        alert('נא לבחור אדם');
        return;
    }
    
    const debt = debts.find(d => d.id === parseInt(personId));
    if (!debt) {
        alert('החוב לא נמצא');
        return;
    }
    
    const updateType = document.getElementById('update-debt-type').value;
    const date = document.getElementById('update-debt-date').value;
    const description = document.getElementById('update-debt-description').value.trim();
    
    if (!date || !description) {
        alert('נא למלא את כל השדות');
        return;
    }
    
    let amount = 0;
    if (updateType !== 'clear') {
        amount = parseFloat(document.getElementById('update-debt-amount').value);
        if (isNaN(amount) || amount <= 0) {
            alert('נא להזין סכום תקין');
            return;
        }
    }
    
    // חישוב הסכום החדש
    let newAmount = debt.currentAmount;
    
    if (updateType === 'increase') {
        newAmount += amount;
    } else if (updateType === 'decrease') {
        newAmount -= amount;
        if (newAmount < 0) {
            if (!confirm('הסכום שהזנת גדול מהחוב הנוכחי. האם אתה בטוח?')) {
                return;
            }
        }
    } else if (updateType === 'clear') {
        amount = debt.currentAmount;
        newAmount = 0;
    }
    
    // עדכון החוב
    debt.currentAmount = newAmount;
    debt.lastUpdateDate = date;
    
    if (newAmount === 0) {
        debt.active = false;
    }
    
    // הוספת רשומה להיסטוריה
    debt.history.push({
        id: Date.now(),
        date: date,
        description: description,
        amount: amount,
        type: updateType,
        runningTotal: newAmount
    });
    
    saveData();
    
    // איפוס השדות
    document.getElementById('update-debt-amount').value = '';
    document.getElementById('update-debt-description').value = '';
    document.getElementById('update-debt-info').style.display = 'none';
    document.getElementById('update-debt-person').value = '';
    
    // עדכון התצוגה
    renderDebts();
    
    // שליחת אירוע לאנליטיקס של Firebase
    try {
        if (typeof analytics !== 'undefined') {
            analytics.logEvent('debt_updated', {
                update_type: updateType,
                amount: amount
            });
        }
    } catch (error) {
        console.error('Analytics error:', error);
    }
}

// פונקציה להצגת החובות הפעילים
function renderDebts() {
    const container = document.getElementById('active-debts');
    if (!container) return;
    
    container.innerHTML = '';
    
    // סינון לפי בחירת המשתמש
    const filterType = document.getElementById('debt-filter').value;
    let filteredDebts = [...debts];
    
    if (filterType !== 'all') {
        filteredDebts = debts.filter(d => d.type === filterType && d.active);
    } else {
        filteredDebts = debts.filter(d => d.active);
    }
    
    // מיון לפי שם
    filteredDebts.sort((a, b) => a.person.localeCompare(b.person));
    
    // חישוב סיכומים
    let totalOwedToMe = 0;
    let totalIOwe = 0;
    
    debts.filter(d => d.active).forEach(debt => {
        if (debt.type === 'they-owe-me') {
            totalOwedToMe += debt.currentAmount;
        } else {
            totalIOwe += debt.currentAmount;
        }
    });
    
    // עדכון סיכומים בממשק
    document.getElementById('total-debt-owed-to-me').textContent = `${totalOwedToMe.toFixed(2)} ₪`;
    document.getElementById('total-debt-i-owe').textContent = `${totalIOwe.toFixed(2)} ₪`;
    
    const balanceElement = document.getElementById('debt-balance');
    const balance = totalOwedToMe - totalIOwe;
    balanceElement.textContent = `${balance.toFixed(2)} ₪`;
    
    if (balance >= 0) {
        balanceElement.className = 'balance-positive';
    } else {
        balanceElement.className = 'balance-negative';
    }
    
    // הצגת החובות
    if (filteredDebts.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'אין חובות פעילים כרגע.';
        container.appendChild(emptyMessage);
        return;
    }
    
    filteredDebts.forEach(debt => {
        const debtElement = document.createElement('div');
        debtElement.className = 'budget-item';
        
        // קביעת סגנון לפי סוג החוב
        if (debt.type === 'they-owe-me') {
            debtElement.style.borderRight = '4px solid var(--primary-color)';
        } else {
            debtElement.style.borderRight = '4px solid var(--danger-color)';
        }
        
        // פורמט תאריכים
        const startDate = new Date(debt.startDate);
        const formattedStartDate = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`;
        
        const lastUpdateDate = new Date(debt.lastUpdateDate);
        const formattedLastUpdateDate = `${lastUpdateDate.getDate().toString().padStart(2, '0')}/${(lastUpdateDate.getMonth() + 1).toString().padStart(2, '0')}/${lastUpdateDate.getFullYear()}`;
        
        // היסטוריה אחרונה
        const lastHistoryItem = debt.history[debt.history.length - 1];
        let lastActionText = '';
        
        if (lastHistoryItem.type === 'create') {
            lastActionText = 'יצירת חוב חדש';
        } else if (lastHistoryItem.type === 'increase') {
            lastActionText = 'הגדלת החוב';
        } else if (lastHistoryItem.type === 'decrease') {
            lastActionText = 'הקטנת החוב';
        } else if (lastHistoryItem.type === 'clear') {
            lastActionText = 'סגירת החוב';
        }
        
        debtElement.innerHTML = `
            <h3>${debt.person}</h3>
            <div class="recurring-details">
                <div class="recurring-detail">
                    <p><strong>סוג החוב</strong></p>
                    <p>${debt.type === 'they-owe-me' ? 'חייבים לי' : 'אני חייב'}</p>
                </div>
                <div class="recurring-detail">
                    <p><strong>סכום נוכחי</strong></p>
                    <p>${debt.currentAmount.toFixed(2)} ₪</p>
                </div>
                <div class="recurring-detail">
                    <p><strong>תאריך התחלה</strong></p>
                    <p>${formattedStartDate}</p>
                </div>
            </div>
            <div class="recurring-details">
                <div class="recurring-detail">
                    <p><strong>סכום התחלתי</strong></p>
                    <p>${debt.initialAmount.toFixed(2)} ₪</p>
                </div>
                <div class="recurring-detail">
                    <p><strong>עדכון אחרון</strong></p>
                    <p>${formattedLastUpdateDate}</p>
                </div>
                <div class="recurring-detail">
                    <p><strong>פעולה אחרונה</strong></p>
                    <p>${lastActionText}</p>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <button class="edit-btn" onclick="showDebtHistory(${debt.id})">הצג היסטוריה</button>
                <button class="delete-btn" onclick="deleteDebt(${debt.id})">מחק חוב</button>
            </div>
        `;
        
        container.appendChild(debtElement);
    });
}

// פונקציה להצגת היסטוריית חוב
function showDebtHistory(debtId) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) {
        alert('החוב לא נמצא');
        return;
    }
    
    // עדכון סלקטור ההיסטוריה
    const historyPersonSelect = document.getElementById('debt-history-person');
    historyPersonSelect.value = debt.id;
    
    // הצגת ההיסטוריה
    renderDebtHistoryForPerson(debt.id);
    
    // גלילה למקטע ההיסטוריה
    document.getElementById('debt-history').scrollIntoView({ behavior: 'smooth' });
    
    // שליחת אירוע לאנליטיקס של Firebase
    try {
        if (typeof analytics !== 'undefined') {
            analytics.logEvent('debt_history_viewed', {
                person: debt.person
            });
        }
    } catch (error) {
        console.error('Analytics error:', error);
    }
}

// פונקציה להצגת היסטוריית חוב לפי אדם
function renderDebtHistoryForPerson(debtId) {
    const container = document.getElementById('debt-history-container');
    if (!container) return;
    
    const debt = debts.find(d => d.id === parseInt(debtId));
    if (!debt) {
        container.innerHTML = '<p>לא נמצאה היסטוריה.</p>';
        container.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    container.style.display = 'block';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'summary';
    headerDiv.style.marginBottom = '20px';
    headerDiv.innerHTML = `
        <div>
            <h3>אדם</h3>
            <p>${debt.person}</p>
        </div>
        <div>
            <h3>סוג החוב</h3>
            <p>${debt.type === 'they-owe-me' ? 'חייבים לי' : 'אני חייב'}</p>
        </div>
        <div>
            <h3>סכום נוכחי</h3>
            <p>${debt.currentAmount.toFixed(2)} ₪</p>
        </div>
        <div>
            <h3>סטטוס</h3>
            <p>${debt.active ? 'פעיל' : 'סגור'}</p>
        </div>
    `;
    
    container.appendChild(headerDiv);
    
    // יצירת טבלת היסטוריה
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>תאריך</th>
                <th>פעולה</th>
                <th>תיאור</th>
                <th>סכום</th>
                <th>יתרה לאחר פעולה</th>
            </tr>
        </thead>
        <tbody id="history-table-body"></tbody>
    `;
    
    container.appendChild(table);
    
    const tableBody = document.getElementById('history-table-body');
    
    // מיון ההיסטוריה לפי תאריך (מהחדש לישן)
    const sortedHistory = [...debt.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedHistory.forEach(item => {
        const row = document.createElement('tr');
        
        // פורמט תאריך
        const itemDate = new Date(item.date);
        const formattedDate = `${itemDate.getDate().toString().padStart(2, '0')}/${(itemDate.getMonth() + 1).toString().padStart(2, '0')}/${itemDate.getFullYear()}`;
        
        // טקסט סוג הפעולה
        let actionText = '';
        if (item.type === 'create') {
            actionText = 'יצירת חוב';
            row.className = 'new-debt';
        } else if (item.type === 'increase') {
            actionText = 'הגדלת חוב';
            row.className = 'increase-debt';
        } else if (item.type === 'decrease') {
            actionText = 'הקטנת חוב';
            row.className = 'decrease-debt';
        } else if (item.type === 'clear') {
            actionText = 'סגירת חוב';
            row.className = 'clear-debt';
        }
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${actionText}</td>
            <td>${item.description}</td>
            <td>${item.amount.toFixed(2)} ₪</td>
            <td>${item.runningTotal.toFixed(2)} ₪</td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // הוספת כפתור ייצוא היסטוריה
    const exportButton = document.createElement('button');
    exportButton.className = 'edit-btn';
    exportButton.style.marginTop = '20px';
    exportButton.textContent = 'ייצוא היסטוריה';
    exportButton.onclick = () => exportDebtHistory(debt);
    container.appendChild(exportButton);
}
}

// פונקציה למחיקת חוב
function deleteDebt(debtId) {
    const debt = debts.find(d => d.id === debtId);
    if (!debt) {
        alert('החוב לא נמצא');
        return;
    }
    
    if (confirm(`האם אתה בטוח שברצונך למחוק את החוב של ${debt.person}? פעולה זו היא בלתי הפיכה.`)) {
        // מחיקת החוב
        debts = debts.filter(d => d.id !== debtId);
        saveData();
        
        // עדכון התצוגה
        renderDebts();
        updateDebtPersonDropdowns();
        
        // סגירת תצוגת ההיסטוריה אם היא פתוחה
        document.getElementById('debt-history-container').style.display = 'none';
        document.getElementById('debt-history-person').value = '';
        
        // שליחת אירוע לאנליטיקס של Firebase
        try {
            if (typeof analytics !== 'undefined') {
                analytics.logEvent('debt_deleted');
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }
}

// פונקציה לעדכון תיבות הבחירה של האנשים
function updateDebtPersonDropdowns() {
    // עדכון סלקטור העדכון
    const updateSelect = document.getElementById('update-debt-person');
    if (updateSelect) {
        updateSelect.innerHTML = '<option value="">-- בחר אדם --</option>';
        
        // רק חובות פעילים
        const activeDebts = debts.filter(d => d.active);
        
        // מיון לפי שם
        activeDebts.sort((a, b) => a.person.localeCompare(b.person));
        
        activeDebts.forEach(debt => {
            const option = document.createElement('option');
            option.value = debt.id;
            option.textContent = `${debt.person} (${debt.type === 'they-owe-me' ? 'חייבים לי' : 'אני חייב'}: ${debt.currentAmount.toFixed(2)} ₪)`;
            updateSelect.appendChild(option);
        });
    }
    
    // עדכון סלקטור ההיסטוריה
    const historySelect = document.getElementById('debt-history-person');
    if (historySelect) {
        historySelect.innerHTML = '<option value="">-- בחר אדם --</option>';
        
        // כל החובות, כולל הלא פעילים
        const allDebts = [...debts];
        
        // מיון לפי שם
        allDebts.sort((a, b) => a.person.localeCompare(b.person));
        
        allDebts.forEach(debt => {
            const option = document.createElement('option');
            option.value = debt.id;
            option.textContent = `${debt.person} (${debt.active ? 'פעיל' : 'סגור'}, ${debt.type === 'they-owe-me' ? 'חייבים לי' : 'אני חייב'}: ${debt.currentAmount.toFixed(2)} ₪)`;
            historySelect.appendChild(option);
        });
    }
}

// פונקציה להצגת פרטי החוב שנבחר לעדכון
function showSelectedDebtInfo() {
    const debtId = document.getElementById('update-debt-person').value;
    const infoDiv = document.getElementById('update-debt-info');
    
    if (!debtId) {
        infoDiv.style.display = 'none';
        return;
    }
    
    const debt = debts.find(d => d.id === parseInt(debtId));
    if (!debt) {
        infoDiv.style.display = 'none';
        return;
    }
    
    // עדכון הפרטים המוצגים
    document.getElementById('debt-current-status').textContent = debt.type === 'they-owe-me' ? 'חייבים לי' : 'אני חייב';
    document.getElementById('debt-current-amount').textContent = `${debt.currentAmount.toFixed(2)} ₪`;
    
    infoDiv.style.display = 'block';
}

// פונקציה להצגת/הסתרת שדה הסכום לפי סוג העדכון
function toggleAmountField() {
    const updateType = document.getElementById('update-debt-type').value;
    const amountGroup = document.getElementById('update-amount-group');
    
    if (updateType === 'clear') {
        amountGroup.style.display = 'none';
    } else {
        amountGroup.style.display = 'block';
    }
}

// פונקציה לשמירת נתוני החובות
function saveDebtsData() {
    // שמירה ב-localStorage
    localStorage.setItem('budget-debts', JSON.stringify(debts));
    
    // סימון שיש נתונים לשמירה בענן
    if (syncState && syncState.isLoggedIn) {
        syncState.pendingSave = true;
        
        // שמירה ב-Firebase
        saveData();
    }
}

// פונקציה לייצוא היסטוריית חוב לקובץ CSV
function exportDebtHistory(debt) {
    if (!debt || !debt.history || debt.history.length === 0) {
        alert('אין היסטוריה זמינה לייצוא');
        return;
    }
    
    // כותרות העמודות
    let csvContent = 'תאריך,פעולה,תיאור,סכום,יתרה\n';
    
    // מיון ההיסטוריה לפי תאריך (מהחדש לישן)
    const sortedHistory = [...debt.history].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // הוספת שורות הנתונים
    sortedHistory.forEach(item => {
        // פורמט תאריך
        const itemDate = new Date(item.date);
        const formattedDate = `${itemDate.getDate().toString().padStart(2, '0')}/${(itemDate.getMonth() + 1).toString().padStart(2, '0')}/${itemDate.getFullYear()}`;
        
        // טקסט סוג הפעולה
        let actionText = '';
        if (item.type === 'create') {
            actionText = 'יצירת חוב';
        } else if (item.type === 'increase') {
            actionText = 'הגדלת חוב';
        } else if (item.type === 'decrease') {
            actionText = 'הקטנת חוב';
        } else if (item.type === 'clear') {
            actionText = 'סגירת חוב';
        }
        
        // בריחת פסיקים בתיאור
        const escapedDescription = item.description.replace(/,/g, ';');
        
        // הוספת השורה
        csvContent += `${formattedDate},${actionText},${escapedDescription},${item.amount.toFixed(2)},${item.runningTotal.toFixed(2)}\n`;
    });
    
    // יצירת קישור להורדה
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    const fileName = `היסטוריית_חוב_${debt.person.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // שליחת אירוע לאנליטיקס של Firebase
    try {
        if (typeof analytics !== 'undefined') {
            analytics.logEvent('debt_history_exported', {
                person: debt.person,
                records_count: debt.history.length
            });
        }
    } catch (error) {
        console.error('Analytics error:', error);
    }
}

// הרחבת פונקציית loadFromLocalStorage
function extendLoadFromLocalStorage() {
    const originalFunction = window.loadFromLocalStorage;
    
    window.loadFromLocalStorage = function() {
        const savedTransactions = localStorage.getItem('budget-transactions');
        const savedRecurring = localStorage.getItem('budget-recurring');
        const savedCategories = localStorage.getItem('budget-categories');
        const savedBudgets = localStorage.getItem('budget-budgets');
        const savedTotalBudget = localStorage.getItem('budget-total-budget');
        const savedDebts = localStorage.getItem('budget-debts');
        
        if (savedTransactions) {
            transactions = JSON.parse(savedTransactions);
        }
        
        if (savedRecurring) {
            recurringExpenses = JSON.parse(savedRecurring);
        }
        
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }
        
        if (savedBudgets) {
            budgets = JSON.parse(savedBudgets);
        }
        
        if (savedTotalBudget) {
            totalBudget = JSON.parse(savedTotalBudget);
        }
        
        if (savedDebts) {
            debts = JSON.parse(savedDebts);
        }
        
        populateCategoryDropdowns();
        renderTransactions();
        renderRecurringExpenses();
        renderCategories();
        renderBudgets();
        renderDebts();
        updateDebtPersonDropdowns();
        generateRecurringTransactions();
        
        dataLoaded = true;
        
        // שליחת אירוע לאנליטיקס של Firebase
        try {
            if (typeof analytics !== 'undefined') {
                analytics.logEvent('data_loaded_from_local_storage');
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    };
}

// הרחבת פונקציית saveData
function extendSaveData() {
    const originalFunction = window.saveData;
    
    window.saveData = function() {
        if (syncState.isLoggedIn) {
            // סימון שיש נתונים לשמירה
            syncState.pendingSave = true;
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(false, 'ממתין לסנכרון...');
            
            // ניסיון מיידי לסנכרן, אם אפשר
            if (!syncState.isSyncing) {
                // טיימר קצר לתת לפעולות נוספות להסתיים
                setTimeout(() => saveAllDataToFirebase(), 1000);
            }
        }
        
        // שמירת הנתונים לאחסון מקומי (גיבוי)
        localStorage.setItem('budget-transactions', JSON.stringify(transactions));
        localStorage.setItem('budget-recurring', JSON.stringify(recurringExpenses));
        localStorage.setItem('budget-categories', JSON.stringify(categories));
        localStorage.setItem('budget-budgets', JSON.stringify(budgets));
        localStorage.setItem('budget-total-budget', JSON.stringify(totalBudget));
        localStorage.setItem('budget-debts', JSON.stringify(debts));
        
        // שליחת אירוע לאנליטיקס של Firebase
        try {
            if (typeof analytics !== 'undefined') {
                analytics.logEvent('data_saved');
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    };
}

// הרחבת פונקציית importData
function extendImportData() {
    const originalFunction = window.importData;
    
    window.importData = function(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.transactions || !data.categories) {
                throw new Error("נתונים לא תקינים");
            }
            
            // שמירת הנתונים החדשים
            transactions = data.transactions;
            recurringExpenses = data.recurringExpenses || [];
            categories = data.categories;
            budgets = data.budgets || [];
            totalBudget = data.totalBudget || { amount: 0, description: '' };
            debts = data.debts || [];
            
            // שמירה וריענון התצוגה
            saveData();
            populateCategoryDropdowns();
            renderTransactions();
            renderRecurringExpenses();
            renderCategories();
            renderBudgets();
            renderDebts();
            updateDebtPersonDropdowns();
            generateRecurringTransactions();
            
            // שליחת אירוע לאנליטיקס של Firebase
            try {
                if (typeof analytics !== 'undefined') {
                    analytics.logEvent('data_imported');
                }
            } catch (error) {
                console.error('Analytics error:', error);
            }
            
            return true;
        } catch (error) {
            alert(`שגיאה בייבוא הנתונים: ${error.message}`);
            return false;
        }
    };
}

// הרחבת פונקציית exportData
function extendExportData() {
    const originalFunction = window.exportData;
    
    window.exportData = function() {
        const data = {
            transactions: transactions,
            recurringExpenses: recurringExpenses,
            categories: categories,
            budgets: budgets,
            totalBudget: totalBudget,
            debts: debts,
            exportDate: new Date().toISOString(),
            version: "1.0"
        };
        
        // יצירת הורדה של קובץ JSON
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileName = `budget_export_${new Date().toISOString().slice(0,10)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileName);
        linkElement.click();
        
        // שליחת אירוע לאנליטיקס של Firebase
        try {
            if (typeof analytics !== 'undefined') {
                analytics.logEvent('data_exported');
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    };
}

// הרחבת פונקציית loadAllDataFromFirebase
function extendLoadAllDataFromFirebase() {
    const originalFunction = window.loadAllDataFromFirebase;
    
    window.loadAllDataFromFirebase = async function() {
        if (!syncState.isLoggedIn || !syncState.userId) {
            console.error('Cannot load data - user not logged in');
            return;
        }
        
        try {
            syncState.isSyncing = true;
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(true, 'טוען נתונים...');
            
            console.log('Loading data from Firebase for user:', syncState.userId);
            
            // טעינת כל סוגי הנתונים במקביל, כולל חובות
            const [
                loadedTransactions,
                loadedRecurringExpenses,
                loadedCategories,
                loadedBudgets,
                loadedTotalBudget,
                loadedDebts
            ] = await Promise.all([
                window.firebaseApp.getUserData(syncState.userId, 'transactions'),
                window.firebaseApp.getUserData(syncState.userId, 'recurringExpenses'),
                window.firebaseApp.getUserData(syncState.userId, 'categories'),
                window.firebaseApp.getUserData(syncState.userId, 'budgets'),
                window.firebaseApp.getUserData(syncState.userId, 'totalBudget'),
                window.firebaseApp.getUserData(syncState.userId, 'debts')
            ]);
            
            console.log('Data loaded from Firebase:', {
                transactions: loadedTransactions ? 'loaded' : 'empty',
                recurringExpenses: loadedRecurringExpenses ? 'loaded' : 'empty',
                categories: loadedCategories ? 'loaded' : 'empty',
                budgets: loadedBudgets ? 'loaded' : 'empty',
                totalBudget: loadedTotalBudget ? 'loaded' : 'empty',
                debts: loadedDebts ? 'loaded' : 'empty'
            });
            
            // עדכון הנתונים המקומיים אם קיימים נתונים
            if (loadedTransactions) transactions = loadedTransactions;
            if (loadedRecurringExpenses) recurringExpenses = loadedRecurringExpenses;
            if (loadedCategories) categories = loadedCategories;
            if (loadedBudgets) budgets = loadedBudgets;
            if (loadedTotalBudget) totalBudget = loadedTotalBudget;
            if (loadedDebts) debts = loadedDebts;
            
            // תיקון עבור תקציב כולל אם לא נטען כראוי
            if (!totalBudget) {
                totalBudget = { amount: 0, description: '' };
            }
            
            // אתחול מערך החובות אם לא נטען
            if (!debts) {
                debts = [];
            }
            
            // וידוא שלקטגוריות יש ערכי ID תקינים
            ensureCategoryIds();
            
            // עדכון זמן הסנכרון האחרון
            syncState.lastSyncTime = new Date();
            dataLoaded = true;
            syncState.pendingSave = false; // איפוס דגל השמירה
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(true);
            
            syncState.isSyncing = false;
            
            // עדכון התצוגה
            populateCategoryDropdowns();
            renderTransactions();
            renderRecurringExpenses();
            renderCategories();
            renderBudgets();
            renderDebts();
            updateDebtPersonDropdowns();
            generateRecurringTransactions();
            
            console.log('All data loaded from Firebase successfully');
            
        } catch (error) {
            syncState.isSyncing = false;
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(false);
            
            console.error('Error loading data from Firebase:', error);
            throw error; // מעביר את השגיאה הלאה כדי שפונקציית ההתחברות תוכל לטפל בה
        }
    };
}

// עדכון פונקציית שמירת הנתונים הכללית
function extendSaveAllDataToFirebase() {
    const originalFunction = window.saveAllDataToFirebase;
    
    window.saveAllDataToFirebase = async function(forceSync = false) {
        if (!syncState.isLoggedIn || !syncState.userId) return;
        
        try {
            // אם כבר מתבצע תהליך סנכרון, נסמן שיש צורך בסנכרון נוסף
            if (syncState.isSyncing && !forceSync) {
                syncState.pendingSave = true;
                console.log('Sync already in progress, marking for later save');
                return;
            }
            
            syncState.isSyncing = true;
            syncState.pendingSave = false;
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(true, 'שומר נתונים...');
            
            console.log('Saving all data to Firebase...');
            
            // שמירת כל סוגי הנתונים, כולל חובות
            const savePromises = [
                window.firebaseApp.saveUserData(syncState.userId, 'transactions', transactions),
                window.firebaseApp.saveUserData(syncState.userId, 'recurringExpenses', recurringExpenses),
                window.firebaseApp.saveUserData(syncState.userId, 'categories', categories),
                window.firebaseApp.saveUserData(syncState.userId, 'budgets', budgets),
                window.firebaseApp.saveUserData(syncState.userId, 'totalBudget', totalBudget),
                window.firebaseApp.saveUserData(syncState.userId, 'debts', debts)
            ];
            
            await Promise.all(savePromises);
            
            // עדכון זמן הסנכרון האחרון
            syncState.lastSyncTime = new Date();
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(true);
            
            syncState.isSyncing = false;
            
            console.log('All data saved to Firebase successfully');
            
        } catch (error) {
            syncState.isSyncing = false;
            syncState.pendingSave = true; // סימון שיש צורך בניסיון נוסף
            
            // עדכון סטטוס סנכרון
            updateSyncStatus(false);
            
            console.error('Error saving all data to Firebase:', error);
            
            // אם זו שמירה מאולצת (למשל בהתחברות או יציאה), להציג שגיאה למשתמש
            if (forceSync) {
                alert('שגיאה בשמירת נתונים: ' + error.message);
            }
        }
    };
}
