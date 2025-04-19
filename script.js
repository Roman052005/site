// ������� ��� ������ � �������
function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// ��������� ����� ��� �������� ���� (����� ���������)
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    const inputs = form.querySelectorAll('input, textarea');
    for (let input of inputs) {
        if (!input.value.trim()) {
            alert(`���� "${input.placeholder}" �� ���� ���� �������`);
            return false;
        }
    }
    return true;
}