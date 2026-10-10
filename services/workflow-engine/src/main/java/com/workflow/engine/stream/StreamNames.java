package com.workflow.engine.stream;

public final class StreamNames {

    public static final String WORKFLOW_EVENTS = "workflow:events";
    public static final String TRANSFORM_EVENTS = "transform:events";
    public static final String STATUS_EVENTS = "status:events";
    public static final String DEAD_LETTER = "workflow:dead-letter";

    public static final String WORKFLOW_ENGINE_GROUP = "workflow-engine-group";
    public static final String TRANSFORM_SERVICE_GROUP = "transform-service-group";

    private StreamNames() {}
}
