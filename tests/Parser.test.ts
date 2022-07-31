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

  it('can parse a custom record xml', () => {
    const xml = `<customrecordtype scriptid="customrecord_dc_wo">
  <description>Description of the record</description>
  <recordname>DC Work Order</recordname>
  <customrecordcustomfields>
    <customrecordcustomfield scriptid="custrecord_dc_wo_service_location">
      <description></description>
      <fieldtype>SELECT</fieldtype>
      <label>Service Hub</label>
      <selectrecordtype>-103</selectrecordtype>
    </customrecordcustomfield>
</customrecordcustomfields>
</customrecordtype>`;

    const parser = new SdfParser({
      code: xml,
      parserOptions: {
        xmlMode: false,
        decodeEntities: false,
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        recognizeSelfClosing: true,
        tab: '2'
      }
    });
    parser.parse();
    const { root } = parser;

    expect(root.children.length).toBeGreaterThan(2);
    console.log('hi');
  });
});
