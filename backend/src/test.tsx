import { generateContent } from "./services/geminiClient";

async function test() {
    const response = await generateContent(
        'Return {"name":"John","email":"john@gmail.com"}'
    );

    console.log(response);
}

test();