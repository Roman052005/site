// Функція для виходу з системи
function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Додаткова логіка для валідації форм (можна розширити)
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    const inputs = form.querySelectorAll('input, textarea');
    for (let input of inputs) {
        if (!input.value.trim()) {
            alert(`Поле "${input.placeholder}" не може бути порожнім`);
            return false;
        }
    }
    return true;
}