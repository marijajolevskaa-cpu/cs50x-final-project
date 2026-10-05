const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:5050",
    // Your Flask app runs here. cy.visit('/') will go to this address.
    supportFile: false,
    // Keeps setup minimal — no extra support file needed for our tests.
  },
});
