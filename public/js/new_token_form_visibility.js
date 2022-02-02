const newTokenVisibilityButton = document.getElementById("show-new-token-button")
const newTokenForm = document.getElementById("new-token-form")

newTokenVisibilityButton.onclick = () => {
    newTokenVisibilityButton.style.display = "none"
    newTokenForm.style.display = "block"
}