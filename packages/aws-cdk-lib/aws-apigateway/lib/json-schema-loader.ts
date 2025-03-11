import { JsonSchema, JsonSchemaType } from './json-schema';

/**
 * Adapter class to convert external JSON Schema objects to the CDK JsonSchema interface.
 * CDK expects the `type` field to be their enum rather than a string with expected values.
 */
export class JsonSchemaLoader {
  /**
   * Convert an external JSON Schema object to a CDK JsonSchema
   * @param obj The JSON Schema object to convert
   * @param restApiId Optional REST API ID for converting $ref to canonical form
   */
  public static fromObject(obj: object, restApiId?: string): JsonSchema {
    const transformed = { ...obj };
    this.transformAdditionalItems(transformed, restApiId);
    this.transformAdditionalProperties(transformed, restApiId);
    this.transformComposition(transformed, restApiId);
    this.transformContains(transformed, restApiId);
    this.transformDefinitions(transformed, restApiId);
    this.transformDependencies(transformed, restApiId);
    this.transformItems(transformed, restApiId);
    this.transformPatternProperties(transformed, restApiId);
    this.transformProperties(transformed, restApiId);
    this.transformPropertyNames(transformed, restApiId);
    this.transformType(transformed);
    this.transformPrefixItems(transformed, restApiId);

    this.transformObjectProperties(transformed);
    return transformed as JsonSchema;
  }

  /**
   * Maps JSON Schema string type values to CDK JsonSchemaType enum values
   */
  private static readonly TYPE_MAP: Record<string, JsonSchemaType> = {
    string: JsonSchemaType.STRING,
    number: JsonSchemaType.NUMBER,
    integer: JsonSchemaType.INTEGER,
    object: JsonSchemaType.OBJECT,
    array: JsonSchemaType.ARRAY,
    boolean: JsonSchemaType.BOOLEAN,
    null: JsonSchemaType.NULL,
  };

  /**
   * Maps JSON Schema property names to CDK JsonSchema interface property names
   */
  private static readonly PROPERTY_MAP: Record<string, string> = {
    $id: 'id',
    $ref: 'ref',
    $schema: 'schema',
  };

  private static transformComposition(obj: Record<string, any>, restApiId?: string): void {
    for (const key of ['allOf', 'oneOf', 'anyOf']) {
      if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map((elem: any) =>
          typeof elem === 'object' ? this.fromObject(elem, restApiId) : elem,
        );
      }
    }

    if (obj.not && typeof obj.not === 'object') {
      obj.not = this.fromObject(obj.not, restApiId);
    }

    if (obj.$ref && restApiId) {
      // Model reference must be in canonical form
      obj.$ref = obj.$ref.replace(
        '#/components/schemas/',
        `https://apigateway.amazonaws.com/restapis/${restApiId}/models/`,
      );
    }
  }

  private static transformType(obj: Record<string, any>): void {
    if (!('type' in obj)) {
      return;
    }

    const objType = obj.type;
    delete obj.type;

    if (typeof objType === 'string') {
      const transformedType = this.TYPE_MAP[objType];
      if (!transformedType) {
        throw new TypeError(`JsonSchema object has an unknown type '${objType}'`);
      }

      // If nullable is set, we need to make the type a list
      if (obj.nullable) {
        delete obj.nullable;
        obj.type = [transformedType, JsonSchemaType.NULL];
      } else {
        obj.type = transformedType;
      }
    } else if (Array.isArray(objType)) {
      obj.type = objType.map(t => {
        const transformed = this.TYPE_MAP[t];
        if (!transformed) {
          throw new TypeError(`JsonSchema object has an unknown type '${t}'`);
        }
        return transformed;
      });
    }
  }

  private static transformProperties(obj: Record<string, any>, restApiId?: string): void {
    if (obj.properties) {
      Object.entries(obj.properties).forEach(([key, value]) => {
        if (typeof value === 'object') {
          obj.properties[key] = this.fromObject(value!, restApiId);
        }
      });
    }
  }

  private static transformPatternProperties(obj: Record<string, any>, restApiId?: string): void {
    if (obj.patternProperties) {
      Object.entries(obj.patternProperties).forEach(([key, value]) => {
        if (typeof value === 'object') {
          obj.patternProperties[key] = this.fromObject(value!, restApiId);
        }
      });
    }
  }

  private static transformAdditionalProperties(obj: Record<string, any>, restApiId?: string): void {
    if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
      obj.additionalProperties = this.fromObject(obj.additionalProperties, restApiId);
    }
  }

  private static transformItems(obj: Record<string, any>, restApiId?: string): void {
    if (!obj.items) {
      return;
    }

    if (Array.isArray(obj.items)) {
      obj.items = obj.items.map((item: any) =>
        typeof item === 'object' ? this.fromObject(item, restApiId) : item,
      );
    } else if (typeof obj.items === 'object') {
      // In Draft 4 - 2019-09, tuple validation was handled by an alternate form of the items keyword.
      // When items was an array of schemas instead of a single schema, it behaved the way prefixItems behaves.
      // https://json-schema.org/understanding-json-schema/reference/array
      obj.items = this.fromObject(obj.items, restApiId);
    }
  }

  private static transformPropertyNames(obj: Record<string, any>, restApiId?: string): void {
    if (obj.propertyNames && typeof obj.propertyNames === 'object') {
      obj.propertyNames = this.fromObject(obj.propertyNames, restApiId);
    }
  }

  private static transformPrefixItems(obj: Record<string, any>, restApiId?: string): void {
    if (Array.isArray(obj.prefixItems)) {
      obj.prefixItems = obj.prefixItems.map((item: any) =>
        typeof item === 'object' ? this.fromObject(item, restApiId) : item,
      );
    }
  }

  private static transformAdditionalItems(obj: Record<string, any>, restApiId?: string): void {
    // Draft-04 expects boolean | JsonSchema
    if (obj.additionalItems && typeof obj.additionalItems === 'object') {
      // cdk JsonSchema interface expects an array
      obj.additionalItems = [this.fromObject(obj.additionalItems, restApiId)];
    }
  }

  private static transformContains(obj: Record<string, any>, restApiId?: string): void {
    if (obj.contains && typeof obj.contains === 'object') {
      obj.contains = this.fromObject(obj.contains, restApiId);
    }
  }

  private static transformDependencies(obj: Record<string, any>, restApiId?: string): void {
    // Previously to Draft 2019-09, dependentRequired and dependentSchemas were one keyword called dependencies.
    // If the dependency value was an array, it would behave like dependentRequired and if the dependency value
    // was a schema, it would behave like dependentSchema.
    // https://json-schema.org/understanding-json-schema/reference/conditionals
    if (!obj.dependencies) {
      return;
    }

    Object.entries(obj.dependencies).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        obj.dependencies[key] = value.map((item: any) =>
          typeof item === 'object' ? this.fromObject(item, restApiId) : item,
        );
      } else if (typeof value === 'object') {
        obj.dependencies[key] = this.fromObject(value!, restApiId);
      }
    });
  }

  private static transformDefinitions(obj: Record<string, any>, restApiId?: string): void {
    if (obj.definitions) {
      Object.entries(obj.definitions).forEach(([key, value]) => {
        if (typeof value === 'object') {
          obj.definitions[key] = this.fromObject(value!, restApiId);
        }
      });
    }
  }

  /**
   * Transform JSON Schema property names to their CDK JsonSchema equivalents
   */
  private static transformObjectProperties(obj: Record<string, any>): void {
    for (const [jsName, cdkName] of Object.entries(this.PROPERTY_MAP)) {
      if (jsName in obj) {
        const value = obj[jsName];
        delete obj[jsName];
        obj[cdkName] = value;
      }
    }
  }
}
