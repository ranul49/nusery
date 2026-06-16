package com.futa.nurserymonitor.util;

import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

public class DownloadExportUtil {

    private DownloadExportUtil() {
        // Utility class
    }

    public static Uri writeTextToDownloads(Context context, String filename, String content, String mimeType) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            cv.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) {
                throw new IOException("Unable to create download URI");
            }
            try (OutputStream os = context.getContentResolver().openOutputStream(uri);
                 OutputStreamWriter w = new OutputStreamWriter(os, StandardCharsets.UTF_8)) {
                w.write(content);
            }
            return uri;
        }

        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
            throw new IOException("Unable to create downloads directory");
        }

        File file = new File(downloadsDir, filename);
        try (FileOutputStream fos = new FileOutputStream(file);
             OutputStreamWriter w = new OutputStreamWriter(fos, StandardCharsets.UTF_8)) {
            w.write(content);
        }
        MediaScannerConnection.scanFile(context, new String[]{file.getAbsolutePath()},
                new String[]{mimeType}, null);
        return null;
    }
}
