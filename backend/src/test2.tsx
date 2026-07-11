import dotenv from "dotenv";
dotenv.config();

async function main() {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );

    const data: any = await res.json();

    for (const model of data.models) {
        if (model.supportedGenerationMethods?.includes("generateContent")) {
            console.log(model.name);
            console.log(model.supportedGenerationMethods);
            console.log("----------------");
        }
    }
}

main();