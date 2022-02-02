function updatePermissionsVisible() {
    if (document.getElementById('admin-checkbox').checked) {
        document.getElementById('permissions').style.display = "none"
    } else {
        document.getElementById('permissions').style.display = "block"
    }
}
updatePermissionsVisible()