let pinVisible = false

const pinVisibilityButton = document.getElementById("pin-visibility-button")
const pinDisplay = document.getElementById("pin-display")

pinVisibilityButton.onclick = () => {
    pinVisible = !pinVisible
    if (pinVisible) {
        pinDisplay.type = "text"
        pinVisibilityButton.firstChild.className = "bi bi-eye-slash"
    } else {
        pinDisplay.type = "password"
        pinVisibilityButton.firstChild.className = "bi bi-eye"
    }
}