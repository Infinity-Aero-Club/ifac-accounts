const noteFormVisibilityButton = document.getElementById("show-add-note-button")
const noteForm = document.getElementById("add-note-form")

noteFormVisibilityButton.onclick = () => {
    noteFormVisibilityButton.style.display = "none"
    noteForm.style.display = "block"
}