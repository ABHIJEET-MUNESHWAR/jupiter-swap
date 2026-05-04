import { GraphQLClient, gql } from 'graphql-request';

const url =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

export const gqlClient = new GraphQLClient(url);

export const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      requestId
      transaction
      inAmount
      outAmount
      otherAmountThreshold
      slippageBps
      priceImpactPct
      status
      lastValidBlockHeight
      routePlan {
        percent
        swapInfo { label inputMint outputMint inAmount outAmount }
      }
    }
  }
`;

export const EXECUTE_ORDER = gql`
  mutation ExecuteOrder($input: ExecuteOrderInput!) {
    executeOrder(input: $input) {
      status
      signature
      slot
      code
      error
      inputAmountResult
      outputAmountResult
    }
  }
`;

export const ASK_ASSISTANT = gql`
  mutation AskAssistant($prompt: String!) {
    askAssistant(prompt: $prompt) {
      message
      parsedOrder { inputMint outputMint amount slippageBps }
    }
  }
`;

