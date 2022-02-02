let ptpwdVisible = false

const ptpwdVisibilityButton = document.getElementById("ptpwd-visibility-button")
const ptpwdDisplay = document.getElementById("ptpwd-display")

ptpwdVisibilityButton.onclick = () => {
    ptpwdVisible = !ptpwdVisible
    if (ptpwdVisible) {
        ptpwdDisplay.type = "text"
        ptpwdVisibilityButton.firstChild.className = "bi bi-eye-slash"
    } else {
        ptpwdDisplay.type = "password"
        ptpwdVisibilityButton.firstChild.className = "bi bi-eye"
    }
}