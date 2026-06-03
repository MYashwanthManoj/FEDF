import { useState, useContext } from "react";
import StudentContext from "../StudentContext";

function StudentForm() {

    const [name, setName] = useState("");

    const { students, setStudents } = useContext(StudentContext);

    const addStudent = () => {

        if(name.trim() === "") return;

        setStudents([...students, name]);
        setName("");
    };

    return (
        <div>
            <h3>Add Student</h3>

            <input
                type="text"
                value={name}
                placeholder="Enter Student Name"
                onChange={(e) => setName(e.target.value)}
            />

            <button onClick={addStudent}>
                Add
            </button>
        </div>
    );
}

export default StudentForm;