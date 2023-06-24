import { test, expect } from "@jest/globals";
import { TransformChain } from "../transform.js";
test("TransformChain", async () => {
    const chain = new TransformChain({
        transform: async (values) => ({
            c: values.a + values.b,
        }),
        inputVariables: ["a", "b"],
        outputVariables: ["c"],
    });
    await expect(chain.call({ a: 1, b: 2 })).resolves.toEqual({ c: 3 });
});
