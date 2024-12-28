const mongoose = require('mongoose');
const Challenge = require('../models/Challenge');
require('dotenv').config();

const challenges = [
  {
    title: "Hello World",
    description: "Write a program that prints 'Hello, World!' to the console.",
    difficulty: "easy",
    testCases: [
      {
        input: "",
        expectedOutput: "Hello, World!",
        isHidden: false
      },
      {
        input: "",
        expectedOutput: "Hello, World!",
        isHidden: true
      }
    ],
    templateCode: {
      javascript: `// Write a program to print "Hello, World!"
// Your code here:

function main() {
    console.log("Hello, World!");
}

main();`,
      python: `# Write a program to print "Hello, World!"
# Your code here:

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()`
    }
  },
  // Add more challenges here
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await Challenge.deleteMany({});
    await Challenge.insertMany(challenges);
    console.log('Challenges seeded successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error seeding challenges:', err);
    process.exit(1);
  }); 