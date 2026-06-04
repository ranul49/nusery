# Add project specific ProGuard rules here.
# Keep Gson model classes (they use @SerializedName reflection)
-keep class com.futa.nurserymonitor.models.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# MPAndroidChart
-keep class com.github.mikephil.charting.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
