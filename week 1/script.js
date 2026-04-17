let students = [];
let editIndex = -1;

// ADD
function addStudent() {
    const id = document.getElementById("studentId").value.trim();
    const name = document.getElementById("studentName").value.trim();
    const attendance = document.getElementById("attendance").value;

    if (!id || !name) {
        alert("Please fill all fields");
        return;
    }

    students.push({ id, name, attendance });

    clearFields();
    renderDOM();
}

// EDIT
function editStudent(index) {
    const student = students[index];

    document.getElementById("studentId").value = student.id;
    document.getElementById("studentName").value = student.name;
    document.getElementById("attendance").value = student.attendance;

    editIndex = index;
}

// UPDATE
function updateStudent() {
    if (editIndex === -1) {
        alert("Select a student to update");
        return;
    }

    students[editIndex] = {
        id: document.getElementById("studentId").value.trim(),
        name: document.getElementById("studentName").value.trim(),
        attendance: document.getElementById("attendance").value
    };

    editIndex = -1;
    clearFields();
    renderDOM();
}

// DELETE
function deleteStudent(index) {
    students.splice(index, 1);
    renderDOM();
}

// CLEAR
function clearFields() {
    document.getElementById("studentId").value = "";
    document.getElementById("studentName").value = "";
    document.getElementById("attendance").value = "Present";
}

// DOM RENDER
function renderDOM() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    students.forEach((student, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.attendance}</td>
            <td>
                <button onclick="editStudent(${index})">Edit</button>
                <button onclick="deleteStudent(${index})">Delete</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// VDOM STYLE RENDER
function renderVDOM() {
    const tbody = document.getElementById("tableBody");

    let html = "";

    students.forEach((student, index) => {
        html += `
            <tr>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.attendance}</td>
                <td>
                    <button onclick="editStudent(${index})">Edit</button>
                    <button onclick="deleteStudent(${index})">Delete</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}