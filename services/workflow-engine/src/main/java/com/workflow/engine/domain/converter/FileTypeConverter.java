package com.workflow.engine.domain.converter;

import com.workflow.engine.domain.enums.FileType;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class FileTypeConverter implements AttributeConverter<FileType, String> {

    @Override
    public String convertToDatabaseColumn(FileType attribute) {
        return attribute == null ? null : attribute.getValue();
    }

    @Override
    public FileType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : FileType.fromValue(dbData);
    }
}
