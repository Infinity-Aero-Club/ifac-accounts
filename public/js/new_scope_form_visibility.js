const newScopeVisibilityButton = document.getElementById("show-new-scope-button")
const newScopeForm = document.getElementById("new-scope-form")

newScopeVisibilityButton.onclick = () => {
    newScopeVisibilityButton.style.display = "none"
    newScopeForm.style.display = "block"
}