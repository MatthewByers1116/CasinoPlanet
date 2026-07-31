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


class InputSinkError(VerifyError):
    """A keyboard event would reach a focused text-entry element as well as the
    page. The keyboard analogue of OccludedError: a key event has no coordinates,
    so the precondition is about the focus target rather than a point -- and it is
    about AMBIGUITY, not interception. Measured: with an <input> focused, the
    character lands in the field AND the keydown still reaches window listeners
    (target=INPUT). Two destinations make anything observed afterwards
    unattributable, so the primitive refuses instead of guessing."""


class SandboxError(VerifyError):
    pass
