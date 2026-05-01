// =======================================
// ES6+ Features + Closures + Functional Programming
// Immutability + Module Pattern
// =======================================

// Module Pattern
const UserApp = (() => {
  
  // Private Data
  let users = [
    { id: 1, name: "Amruthavalli", age: 25 },
    { id: 2, name: "Amruth", age: 28 },
    { id: 3, name: "Srivalli", age: 22 }
  ];

  // Closure Counter
  const createCounter = () => {
    let count = 0;

    return () => {
      count++;
      return count;
    };
  };

  const userCounter = createCounter();

  return {

    // Display Users
    showUsers() {
      console.log("\nAll Users:");
      users.forEach(user =>
        console.log(`ID: ${user.id}, Name: ${user.name}, Age: ${user.age}`)
      );
    },

    // Add User (ES6 + Immutability)
    addUser(name, age) {
      const newUser = {
        id: userCounter() + users.length,
        name,
        age
      };

      users = [...users, newUser];

      console.log(`\nUser Added: ${name}`);
    },

    // Functional Programming - Filter Adults
    showAdults() {
      const adults = users.filter(user => user.age >= 25);

      console.log("\nUsers Age >= 25:");
      adults.forEach(user =>
        console.log(`${user.name} (${user.age})`)
      );
    },

    // Functional Programming - Map Names
    showNames() {
      const names = users.map(user => user.name);

      console.log("\nUser Names:");
      console.log(names);
    },

    // Update User (Immutability)
    updateAge(id, newAge) {
      users = users.map(user =>
        user.id === id ? { ...user, age: newAge } : user
      );

      console.log(`\nUpdated Age of User ID ${id}`);
    }
  };

})();

// =======================================
// Execute Program
// =======================================

UserApp.showUsers();

UserApp.addUser("Ravi", 30);

UserApp.showUsers();

UserApp.showAdults();

UserApp.showNames();

UserApp.updateAge(2, 35);

UserApp.showUsers();