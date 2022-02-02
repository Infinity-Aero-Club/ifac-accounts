const uploadFormVisibilityButton = document.getElementById("show-file-upload-button")
const uploadForm = document.getElementById("file-upload-form")

uploadFormVisibilityButton.onclick = () => {
    uploadFormVisibilityButton.style.display = "none"
    uploadForm.style.display = "block"
}