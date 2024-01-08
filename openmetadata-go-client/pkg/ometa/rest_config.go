package ometa

// RestConfig is the configuration for the Rest client
type RestConfig struct {
	BaseURL       string // Base URL of the OpenMetadata server
	APIVersion    string // optional - default: v1 - use "" to set default
	Retry         int8   // optional - default: 3 - use 0 to set default
	RetryWait     int16  // optional - default: 30 - use 0 to set default
	RetryCodes    []int  // optional - default: [429, 504] - use nil to set default
	AuthTokenMode string // Authentication mode (e.g. Bearer)
	AccessToken   string // Access token
}

func (restConfig *RestConfig) setDefaults() {
	if restConfig.APIVersion == "" {
		restConfig.APIVersion = "v1"
	}
	if restConfig.Retry == 0 || restConfig.Retry < 0 {
		restConfig.Retry = 3
	}
	if restConfig.RetryWait == 0 || restConfig.RetryWait < 0 {
		restConfig.RetryWait = 30
	}
	if restConfig.RetryCodes == nil {
		restConfig.RetryCodes = []int{429, 504}
	}
}

// NewRestConfig creates a new RestConfig
func NewRestConfig(
	baseURL string,
	apiVersion string, // optional - default: v1 - use "" to set default
	retry int8, // optional - default: 3 - use 0 to set default
	retryWait int16, // optional - default: 30 - use 0 to set default
	retryCodes []int, // optional - default: [429, 504] - use nil to set default
	accessToken string) *RestConfig {
	restConfig := &RestConfig{
		BaseURL:       baseURL,
		APIVersion:    apiVersion,
		Retry:         retry,
		RetryWait:     retryWait,
		RetryCodes:    retryCodes,
		AuthTokenMode: "Bearer",
		AccessToken:   accessToken,
	}

	restConfig.setDefaults()
	return restConfig
}
