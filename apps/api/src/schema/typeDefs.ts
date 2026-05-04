export const typeDefs = /* GraphQL */ `
  scalar BigIntString
  scalar DateTime

  enum SwapMode { ExactIn ExactOut }
  enum OrderStatus { Created AwaitingSignature Submitted Success Failed Expired }

  type SwapInfo {
    ammKey: String!
    label: String
    inputMint: String!
    outputMint: String!
    inAmount: BigIntString!
    outAmount: BigIntString!
    feeAmount: BigIntString!
    feeMint: String!
  }

  type RoutePlanStep {
    swapInfo: SwapInfo!
    percent: Int!
  }

  type Order {
    requestId: ID!
    transaction: String!
    inputMint: String!
    outputMint: String!
    inAmount: BigIntString!
    outAmount: BigIntString!
    otherAmountThreshold: BigIntString!
    swapMode: SwapMode!
    slippageBps: Int!
    priceImpactPct: Float!
    routePlan: [RoutePlanStep!]!
    contextSlot: BigIntString
    prioritizationFeeLamports: BigIntString
    expiresAt: DateTime
    lastValidBlockHeight: BigIntString
    status: OrderStatus!
  }

  type ExecuteResult {
    status: OrderStatus!
    signature: String
    slot: BigIntString
    code: Int
    error: String
    inputAmountResult: BigIntString
    outputAmountResult: BigIntString
  }

  type ParsedSwapIntent {
    inputMint: String!
    outputMint: String!
    amount: String!
    slippageBps: Int!
    swapMode: SwapMode!
  }

  type AssistantReply {
    message: String!
    parsedOrder: ParsedSwapIntent
  }

  type Health {
    status: String!
    version: String!
    uptimeMs: Int!
  }

  input CreateOrderInput {
    inputMint: String!
    outputMint: String!
    amount: BigIntString!
    taker: String
    slippageBps: Int
    referralAccount: String
    referralFee: Int
  }

  input ExecuteOrderInput {
    requestId: ID!
    signedTransaction: String!
    lastValidBlockHeight: BigIntString
  }

  type Query {
    health: Health!
    getOrder(requestId: ID!): Order!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    executeOrder(input: ExecuteOrderInput!): ExecuteResult!
    askAssistant(prompt: String!): AssistantReply!
  }

  type Subscription {
    orderStatus(requestId: ID!): OrderStatus!
  }
`;

