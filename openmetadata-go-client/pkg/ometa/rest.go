// Package ometa is used to make rest calls to the openmetadata server.
// It contains 2 types `RestConfig` and `Rest`.
// `RestConfig` is used to configure the rest client (e.g. base URL, token, etc.)
// whule `Rest` is used to make rest calls (GET, POST, PUT, PATCH, DELETE).
package ometa

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Rest is the API client to interact with the OpenMetadata server
type Rest struct {
	restConfig       *RestConfig
	bearerAuthString string
	req              *http.Request
}

// NewRest used to Instantiate a new Rest client
func NewRest(restConfig *RestConfig) *Rest {
	bearerAuthString := fmt.Sprintf("%s %s", restConfig.AuthTokenMode, restConfig.AccessToken)

	return &Rest{
		restConfig:       restConfig,
		bearerAuthString: bearerAuthString,
		req:              nil,
	}
}

func (rest *Rest) request(
	method string,
	path string,
	data []byte,
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	baseURL := rest.restConfig.BaseURL
	apiVersion := rest.restConfig.APIVersion
	url := fmt.Sprintf("%s/api/%s/%s", baseURL, apiVersion, path)

	header = setHeader(header, rest.bearerAuthString)
	if method == http.MethodPatch {
		// Override the content type for patch requests
		header.Set("Content-Type", "application/json-patch+json")
	}
	setExtraHeader(extraHeader, header)

	var err error
	if data != nil {
		rest.req, err = http.NewRequest(method, url, bytes.NewReader(data))
	} else {
		rest.req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	rest.req.Header = header
	rest.setQueryParams(queryParams)
	body, err := rest.dispatchRequest()

	return body, err
}

func (rest Rest) dispatchRequest() (map[string]any, error) {
	retries := rest.restConfig.Retry
	var resp *http.Response
	var err error

	for retries > 0 {
		resp, err = http.DefaultClient.Do(rest.req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 400 && shouldRetry(rest.restConfig.RetryCodes, *resp) {
			retries--
			continue
		}
		break
	}

	defer resp.Body.Close()
	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var body map[string]any
	err = json.Unmarshal(rawBody, &body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func (rest *Rest) setQueryParams(queryParams map[string]string) {
	q := rest.req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	rest.req.URL.RawQuery = q.Encode()
}

// Get Method to make GET calls
func (rest Rest) Get(
	path string,
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	return rest.request(http.MethodGet, path, nil, header, extraHeader, queryParams)
}

// Post Method to make POST calls
func (rest Rest) Post(
	path string,
	data map[string]interface{},
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	bytesData, err := convertMapToBytes(data)
	if err != nil {
		return nil, err
	}
	return rest.request(http.MethodPost, path, bytesData, header, extraHeader, queryParams)
}

// Put Method to make PUT calls
func (rest Rest) Put(
	path string,
	data map[string]interface{},
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	bytesData, err := convertMapToBytes(data)
	if err != nil {
		return nil, err
	}
	return rest.request(http.MethodPut, path, bytesData, header, extraHeader, queryParams)
}

// Patch Method to make PATCH calls
func (rest Rest) Patch(
	path string,
	data []map[string]interface{},
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	bytesData, err := convertMapToBytes(data)
	if err != nil {
		return nil, err
	}
	return rest.request(http.MethodPatch, path, bytesData, header, extraHeader, queryParams)
}

// Delete Method to make DELETE calls
func (rest Rest) Delete(
	path string,
	header http.Header,
	extraHeader map[string][]string,
	queryParams map[string]string) (map[string]any, error) {
	return rest.request(http.MethodDelete, path, nil, header, extraHeader, queryParams)
}

func convertMapToBytes(data interface{}) ([]byte, error) {
	var buff bytes.Buffer
	encoder := json.NewEncoder(&buff)
	err := encoder.Encode(data)
	if err != nil {
		return nil, err
	}
	return buff.Bytes(), nil
}

func shouldRetry(retryCodes []int, resp http.Response) bool {
	for _, code := range retryCodes {
		// check if the error is a retryable error if so
		// retry the request else return the error
		if resp.StatusCode == code {
			return true
		}
	}
	return false
}

func setHeader(header http.Header, bearerAuthString string) http.Header {
	if header == nil {
		header = http.Header{
			"Content-Type":  {"application/json"},
			"Authorization": {bearerAuthString},
		}
		return header
	}

	return header
}

func setExtraHeader(extraHeader map[string][]string, header http.Header) {
	if extraHeader != nil {
		for key, value := range extraHeader {
			header[key] = value
		}
	}
}
