import SdfParser from '../src/Parser';

describe('Parser', () => {
  it('is something', () => {
    expect(SdfParser).toBeDefined();
  });

  it('can parse xml', () => {
    const code = `
    <entityForm scriptid="custform123">
      <sometag>somevalue</sometag>
      <label/>
    </entityForm>
    `;

    const parser = new SdfParser({ code });

    parser.parse();

    console.log('hi');
    // trigger the parser but we do not need the output
  });
});
