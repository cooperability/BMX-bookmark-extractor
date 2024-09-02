import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAI } from "langchain/llms/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";
import { indexName, timeout } from "./config";

export const createPineconeIndex = async (
  client,
  indexName,
  vectorDimension
) => {
  //Check if index exists
  console.log(`Checking "${indexName}...`);
  const existingIndexes = await client.listIndexes();

  //If index doesn't exist, make one
  if (!existingIndexes.includes(indexName)) {
    console.log(`Creating ${indexName}`);
    await client.createIndex({
      createRequest: {
        name: indexName,
        dimension: vectorDimension,
        metric: "cosine",
      },
    });
    console.log(`Creating index...please wait`);
    //await initialization
    await new Promise((resolve) => setTimeout(resolve, timeout));
  } else {
    //or state if the index already exists
    console.log(`"${indexName}" already exists.`);
  }
};

export const updatePinecone = async (client, indexName, docs) => {};
