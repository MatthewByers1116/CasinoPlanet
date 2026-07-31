"""Error taxonomy for tools/verify. Every failure mode named in the spec gets a
distinct class so a caller can never mistake a transport death for a game verdict."""


class VerifyError(Exception):
    pass


class TransportError(VerifyError):
    """The CDP transport is dead. Never raised as a method-named TimeoutError (spec 4.4)."""


class JSEvaluationError(VerifyError):
    """Runtime.evaluate reported exceptionDetails. Raised, never returned (spec 4.1 #3)."""


class BootError(VerifyError):
    pass


class SceneError(VerifyError):
    pass


class GeometryError(VerifyError):
    pass


class OccludedError(VerifyError):
    pass


class SandboxError(VerifyError):
    pass
