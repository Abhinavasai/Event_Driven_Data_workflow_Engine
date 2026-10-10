package com.workflow.engine.exception;

public class StepExecutionException extends WorkflowException {

    public StepExecutionException(String message) {
        super(message);
    }

    public StepExecutionException(String message, Throwable cause) {
        super(message, cause);
    }
}
