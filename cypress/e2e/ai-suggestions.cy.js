describe('AI suggestions feature', () => {

  it('shows suggestions when the API succeeds', () => {
    // STUNT DOUBLE: intercept the API call and return a fake SUCCESS response.
    // The real server/AI is never involved.
    cy.intercept('POST', '/api/suggest-improvements', {
      statusCode: 200,
      body: { ok: true, suggestions: 'Consider adding the recipient name.' },
    }).as('suggest');   // nickname so we can wait for it

    cy.visit('/');                                  // load the homepage
    cy.contains('Request a poem').click();          // open the request modal
    cy.get('#ai-suggest-btn').click();              // click our AI button
    cy.wait('@suggest');                            // wait for the (faked) call
    cy.get('#ai-suggestions')                       // check the display area
      .should('contain', 'recipient name');         // it shows the suggestions
  });

  it('shows a friendly error when the API fails', () => {
    // STUNT DOUBLE: this time return a FAILURE (503).
    cy.intercept('POST', '/api/suggest-improvements', {
      statusCode: 503,
      body: { ok: false, error: 'unavailable' },
    }).as('suggest');

    cy.visit('/');
    cy.contains('Request a poem').click();
    cy.get('#ai-suggest-btn').click();
    cy.wait('@suggest');
    cy.get('#ai-suggestions')
      .should('contain', 'unavailable right now');   // friendly error shown
  });

});
