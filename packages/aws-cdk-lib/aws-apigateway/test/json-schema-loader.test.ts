import { JsonSchema, JsonSchemaType } from '../lib/json-schema';
import { JsonSchemaLoader } from '../lib/json-schema-loader';

describe('JsonSchemaLoader', () => {
  test('transforms basic types', () => {
    const input = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
        height: { type: 'number' },
        isActive: { type: 'boolean' },
        tags: { type: 'array' },
        optional: { type: 'null' },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.properties?.name.type).toBe(JsonSchemaType.STRING);
    expect(result.properties?.age.type).toBe(JsonSchemaType.INTEGER);
    expect(result.properties?.height.type).toBe(JsonSchemaType.NUMBER);
    expect(result.properties?.isActive.type).toBe(JsonSchemaType.BOOLEAN);
    expect(result.properties?.tags.type).toBe(JsonSchemaType.ARRAY);
    expect(result.properties?.optional.type).toBe(JsonSchemaType.NULL);
  });

  test('transforms nullable types', () => {
    const input = {
      type: 'object',
      properties: {
        nullableName: {
          type: 'string',
          nullable: true,
        },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.properties?.nullableName.type).toEqual([JsonSchemaType.STRING, JsonSchemaType.NULL]);
  });

  test('transforms array type schemas', () => {
    const input = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.ARRAY);
    expect(result.items).toBeDefined();
    if (!Array.isArray(result.items)) {
      expect(result.items?.type).toBe(JsonSchemaType.OBJECT);
      expect(result.items?.properties?.id.type).toBe(JsonSchemaType.STRING);
    }
  });

  test('transforms tuple validation schemas', () => {
    const input = {
      type: 'array',
      items: [
        { type: 'string' },
        { type: 'number' },
      ],
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.ARRAY);
    expect(Array.isArray(result.items)).toBe(true);
    expect((result.items as JsonSchema[])[0].type).toBe(JsonSchemaType.STRING);
    expect((result.items as JsonSchema[])[1].type).toBe(JsonSchemaType.NUMBER);
  });

  test('transforms additional items', () => {
    const input = {
      type: 'array',
      items: [
        { type: 'string' },
        { type: 'number' },
      ],
      additionalItems: { type: 'integer' },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.ARRAY);
    expect(Array.isArray(result.items)).toBe(true);
    expect((result.items as JsonSchema[])[0].type).toBe(JsonSchemaType.STRING);
    expect((result.items as JsonSchema[])[1].type).toBe(JsonSchemaType.NUMBER);
    expect(Array.isArray(result.additionalItems)).toBe(true);
    expect(result.additionalItems![0].type).toBe(JsonSchemaType.INTEGER);
  });

  test('preserves boolean additionalItems', () => {
    const input = {
      type: 'array',
      items: [
        { type: 'string' },
        { type: 'number' },
      ],
      additionalItems: false,
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.ARRAY);
    expect(Array.isArray(result.items)).toBe(true);
    expect((result.items as JsonSchema[])[0].type).toBe(JsonSchemaType.STRING);
    expect((result.items as JsonSchema[])[1].type).toBe(JsonSchemaType.NUMBER);
    expect(result.additionalItems).toBe(false);
  });

  test('transforms composition keywords', () => {
    const input = {
      allOf: [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'integer' } } },
      ],
      anyOf: [
        { type: 'object', properties: { email: { type: 'string' } } },
        { type: 'object', properties: { phone: { type: 'string' } } },
      ],
      oneOf: [
        { type: 'object', properties: { country: { type: 'string' } } },
        { type: 'object', properties: { region: { type: 'string' } } },
      ],
      not: { type: 'string' },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.allOf?.[0].type).toBe(JsonSchemaType.OBJECT);
    expect(result.allOf?.[0].properties?.name.type).toBe(JsonSchemaType.STRING);
    expect(result.allOf?.[1].properties?.age.type).toBe(JsonSchemaType.INTEGER);

    expect(result.anyOf?.[0].type).toBe(JsonSchemaType.OBJECT);
    expect(result.anyOf?.[0].properties?.email.type).toBe(JsonSchemaType.STRING);
    expect(result.anyOf?.[1].properties?.phone.type).toBe(JsonSchemaType.STRING);

    expect(result.oneOf?.[0].type).toBe(JsonSchemaType.OBJECT);
    expect(result.oneOf?.[0].properties?.country.type).toBe(JsonSchemaType.STRING);
    expect(result.oneOf?.[1].properties?.region.type).toBe(JsonSchemaType.STRING);

    expect(result.not?.type).toBe(JsonSchemaType.STRING);
  });

  test('transforms pattern properties', () => {
    const input = {
      type: 'object',
      patternProperties: {
        '^S_': { type: 'string' },
        '^I_': { type: 'integer' },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.patternProperties!['^S_'].type).toBe(JsonSchemaType.STRING);
    expect(result.patternProperties!['^I_'].type).toBe(JsonSchemaType.INTEGER);
  });

  test('transforms additional properties', () => {
    const input = {
      type: 'object',
      additionalProperties: { type: 'string' },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.additionalProperties).toBeDefined();
    if (typeof result.additionalProperties === 'object') {
      expect(result.additionalProperties.type).toBe(JsonSchemaType.STRING);
    }
  });

  test('transforms dependencies', () => {
    const input = {
      type: 'object',
      dependencies: {
        creditCard: ['billingAddress'],
        billingAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
          },
        },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(Array.isArray(result.dependencies?.creditCard)).toBe(true);
    expect(result.dependencies?.creditCard).toContain('billingAddress');
    expect((result.dependencies?.billingAddress as JsonSchema).type).toBe(JsonSchemaType.OBJECT);
    expect((result.dependencies?.billingAddress as JsonSchema).properties?.street.type).toBe(JsonSchemaType.STRING);
  });

  test('transforms property names', () => {
    const input = {
      type: 'object',
      propertyNames: {
        type: 'string',
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.propertyNames?.type).toBe(JsonSchemaType.STRING);
    expect(result.propertyNames?.pattern).toBe('^[A-Za-z_][A-Za-z0-9_]*$');
  });

  test('transforms definitions', () => {
    const input = {
      definitions: {
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
        phone: {
          type: 'string',
          pattern: '^[0-9-]+$',
        },
      },
      type: 'object',
      properties: {
        homeAddress: {
          $ref: '#/definitions/address',
        },
        workPhone: {
          $ref: '#/definitions/phone',
        },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    // Check the definitions themselves
    expect(result.definitions?.address.type).toBe(JsonSchemaType.OBJECT);
    expect(result.definitions?.address.properties?.street.type).toBe(JsonSchemaType.STRING);
    expect(result.definitions?.address.properties?.city.type).toBe(JsonSchemaType.STRING);
    expect(result.definitions?.phone.type).toBe(JsonSchemaType.STRING);
    expect(result.definitions?.phone.pattern).toBe('^[0-9-]+$');

    // Check the properties that reference the definitions
    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.properties?.homeAddress.ref).toBe('#/definitions/address');
    expect(result.properties?.workPhone.ref).toBe('#/definitions/phone');
  });

  test('transforms refs with rest api id', () => {
    const input = {
      $ref: '#/components/schemas/Pet',
    };

    const result = JsonSchemaLoader.fromObject(input, 'abc123');

    expect(result.ref).toBe('https://apigateway.amazonaws.com/restapis/abc123/models/Pet');
  });

  test('throws error for unknown type', () => {
    const input = {
      type: 'unknown',
    };

    expect(() => JsonSchemaLoader.fromObject(input)).toThrow("JsonSchema object has an unknown type 'unknown'");
  });

  test('transforms complex nested schema', () => {
    const input = {
      type: 'object',
      required: ['name', 'photoUrls'],
      properties: {
        id: {
          type: 'integer',
          format: 'int64',
        },
        name: {
          type: 'string',
        },
        category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
            },
            name: {
              type: 'string',
            },
          },
        },
        photoUrls: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                format: 'int64',
              },
              name: {
                type: 'string',
              },
            },
          },
        },
        status: {
          type: 'string',
          description: 'pet status in the store',
          enum: ['available', 'pending', 'sold'],
        },
      },
    };

    const result = JsonSchemaLoader.fromObject(input);

    expect(result.type).toBe(JsonSchemaType.OBJECT);
    expect(result.required).toEqual(['name', 'photoUrls']);

    // Check id property
    expect(result.properties?.id.type).toBe(JsonSchemaType.INTEGER);
    expect(result.properties?.id.format).toBe('int64');

    // Check name property
    expect(result.properties?.name.type).toBe(JsonSchemaType.STRING);

    // Check category property
    expect(result.properties?.category.type).toBe(JsonSchemaType.OBJECT);
    expect(result.properties?.category.properties?.id.type).toBe(JsonSchemaType.INTEGER);
    expect(result.properties?.category.properties?.name.type).toBe(JsonSchemaType.STRING);

    // Check photoUrls property
    expect(result.properties?.photoUrls.type).toBe(JsonSchemaType.ARRAY);
    if (!Array.isArray(result.properties?.photoUrls.items)) {
      expect(result.properties?.photoUrls.items?.type).toBe(JsonSchemaType.STRING);
    }

    // Check tags property
    expect(result.properties?.tags.type).toBe(JsonSchemaType.ARRAY);
    if (!Array.isArray(result.properties?.tags.items)) {
      expect(result.properties?.tags.items?.type).toBe(JsonSchemaType.OBJECT);
      expect(result.properties?.tags.items?.properties?.id.type).toBe(JsonSchemaType.INTEGER);
      expect(result.properties?.tags.items?.properties?.name.type).toBe(JsonSchemaType.STRING);
    }

    // Check status property
    expect(result.properties?.status.type).toBe(JsonSchemaType.STRING);
    expect(result.properties?.status.description).toBe('pet status in the store');
    expect(result.properties?.status.enum).toEqual(['available', 'pending', 'sold']);
  });
});
