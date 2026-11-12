// A web update starts inside the previous standalone server. Its serialized
// config omits functions. Let the build CLI load next.config.ts from checkout.
delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
